import { Pool } from 'pg';
import pool from '../config/database';
import logger from '../utils/logger';

export interface CCTransaction {
  userId: string;
  type: 'stake_lock' | 'stake_refund' | 'challenge_win' | 'challenge_loss' | 'bonus' | 'admin_grant' | 'admin_deduct' | 'initial_grant';
  amount: number;
  challengeId?: string;
  description?: string;
  metadata?: any;
}

export interface CCBalance {
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  lastTransaction?: Date;
}

class ClubCoinService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  /**
   * Get user's current CC balance
   */
  async getBalance(userId: string): Promise<CCBalance> {
    try {
      const query = `
        SELECT 
          cp.user_id,
          cp.cc_balance as balance,
          cp.total_cc_earned as total_earned,
          cp.total_cc_spent as total_spent,
          cp.last_challenge_at as last_transaction
        FROM customer_profiles cp
        WHERE cp.user_id = $1
      `;

      const result = await this.pool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        // Create profile if doesn't exist
        await this.createUserProfile(userId);
        return {
          userId,
          balance: 0,
          totalEarned: 0,
          totalSpent: 0
        };
      }

      return {
        userId: result.rows[0].user_id,
        balance: parseFloat(result.rows[0].balance || 0),
        totalEarned: parseFloat(result.rows[0].total_earned || 0),
        totalSpent: parseFloat(result.rows[0].total_spent || 0),
        lastTransaction: result.rows[0].last_transaction
      };
    } catch (error) {
      logger.error('Error getting CC balance:', error);
      throw error;
    }
  }

  /**
   * Check if user has sufficient balance
   */
  async hasBalance(userId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance.balance >= amount;
  }

  /**
   * Add CC to user's balance
   */
  async credit(transaction: CCTransaction): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get current balance
      const balanceQuery = `
        SELECT cc_balance 
        FROM customer_profiles 
        WHERE user_id = $1 
        FOR UPDATE
      `;
      const balanceResult = await client.query(balanceQuery, [transaction.userId]);
      
      if (balanceResult.rows.length === 0) {
        await this.createUserProfile(transaction.userId, client);
        balanceResult.rows.push({ cc_balance: 0 });
      }

      const currentBalance = parseFloat(balanceResult.rows[0].cc_balance || 0);
      const newBalance = currentBalance + Math.abs(transaction.amount);

      // Update balance
      const updateQuery = `
        UPDATE customer_profiles 
        SET 
          cc_balance = $1,
          total_cc_earned = total_cc_earned + $2,
          last_challenge_at = CURRENT_TIMESTAMP
        WHERE user_id = $3
      `;
      await client.query(updateQuery, [newBalance, Math.abs(transaction.amount), transaction.userId]);

      // Log transaction
      const logQuery = `
        INSERT INTO cc_transactions (
          user_id, type, amount, balance_before, balance_after,
          challenge_id, description, metadata, season_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, get_current_season()
        )
      `;
      await client.query(logQuery, [
        transaction.userId,
        transaction.type,
        Math.abs(transaction.amount),
        currentBalance,
        newBalance,
        transaction.challengeId || null,
        transaction.description || null,
        JSON.stringify(transaction.metadata || {}),
      ]);

      // Update seasonal earnings
      await this.updateSeasonalEarnings(
        transaction.userId, 
        Math.abs(transaction.amount), 
        transaction.type,
        client
      );

      await client.query('COMMIT');
      
      logger.info(`CC credited: ${transaction.amount} to user ${transaction.userId}`);
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error crediting CC:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Deduct CC from user's balance
   */
  async debit(transaction: CCTransaction): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get current balance with lock
      const balanceQuery = `
        SELECT cc_balance 
        FROM customer_profiles 
        WHERE user_id = $1 
        FOR UPDATE
      `;
      const balanceResult = await client.query(balanceQuery, [transaction.userId]);
      
      if (balanceResult.rows.length === 0) {
        throw new Error('User profile not found');
      }

      const currentBalance = parseFloat(balanceResult.rows[0].cc_balance || 0);
      const debitAmount = Math.abs(transaction.amount);

      // Check sufficient balance
      if (currentBalance < debitAmount) {
        throw new Error(`Insufficient CC balance. Required: ${debitAmount}, Available: ${currentBalance}`);
      }

      const newBalance = currentBalance - debitAmount;

      // Update balance
      const updateQuery = `
        UPDATE customer_profiles 
        SET 
          cc_balance = $1,
          total_cc_spent = total_cc_spent + $2,
          last_challenge_at = CURRENT_TIMESTAMP
        WHERE user_id = $3
      `;
      await client.query(updateQuery, [newBalance, debitAmount, transaction.userId]);

      // Log transaction
      const logQuery = `
        INSERT INTO cc_transactions (
          user_id, type, amount, balance_before, balance_after,
          challenge_id, description, metadata, season_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, get_current_season()
        )
      `;
      await client.query(logQuery, [
        transaction.userId,
        transaction.type,
        -debitAmount, // Negative for debits
        currentBalance,
        newBalance,
        transaction.challengeId || null,
        transaction.description || null,
        JSON.stringify(transaction.metadata || {}),
      ]);

      // Update seasonal losses
      if (transaction.type === 'challenge_loss' || transaction.type === 'stake_lock') {
        await this.updateSeasonalLosses(transaction.userId, debitAmount, client);
      }

      await client.query('COMMIT');
      
      logger.info(`CC debited: ${debitAmount} from user ${transaction.userId}`);
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error debiting CC:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Transfer CC between users (for challenge payouts)
   */
  async transfer(
    fromUserId: string,
    toUserId: string,
    amount: number,
    challengeId: string,
    description?: string
  ): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Debit from loser
      await this.debit({
        userId: fromUserId,
        type: 'challenge_loss',
        amount,
        challengeId,
        description: description || 'Challenge loss'
      });

      // Credit to winner
      await this.credit({
        userId: toUserId,
        type: 'challenge_win',
        amount,
        challengeId,
        description: description || 'Challenge win'
      });

      await client.query('COMMIT');
      
      logger.info(`CC transferred: ${amount} from ${fromUserId} to ${toUserId} for challenge ${challengeId}`);
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error transferring CC:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Lock stakes for a challenge
   */
  async lockStakes(
    challengeId: string,
    creatorId: string,
    creatorStake: number,
    acceptorId: string,
    acceptorStake: number
  ): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Lock creator stake
      await this.debit({
        userId: creatorId,
        type: 'stake_lock',
        amount: creatorStake,
        challengeId,
        description: 'Challenge stake locked (creator)'
      });

      // Lock acceptor stake
      await this.debit({
        userId: acceptorId,
        type: 'stake_lock',
        amount: acceptorStake,
        challengeId,
        description: 'Challenge stake locked (acceptor)'
      });

      // Update stakes table
      const stakeQuery = `
        UPDATE stakes 
        SET is_locked = true, locked_at = CURRENT_TIMESTAMP 
        WHERE challenge_id = $1
      `;
      await client.query(stakeQuery, [challengeId]);

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error locking stakes:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Refund stakes (for expired/cancelled challenges)
   */
  async refundStakes(
    challengeId: string,
    userId: string,
    amount: number,
    reason: string
  ): Promise<boolean> {
    return this.credit({
      userId,
      type: 'stake_refund',
      amount,
      challengeId,
      description: `Stake refund: ${reason}`
    });
  }

  /**
   * Award bonus CC (minted, not from pot)
   */
  async awardBonus(
    userId: string,
    amount: number,
    challengeId?: string,
    description?: string
  ): Promise<boolean> {
    return this.credit({
      userId,
      type: 'bonus',
      amount,
      challengeId,
      description: description || 'Bonus CC awarded'
    });
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    try {
      const query = `
        SELECT 
          id,
          type,
          amount,
          balance_before,
          balance_after,
          challenge_id,
          description,
          metadata,
          created_at
        FROM cc_transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.pool.query(query, [userId, limit, offset]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting transaction history:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard for season
   */
  async getSeasonLeaderboard(seasonId?: string, limit: number = 100): Promise<any[]> {
    try {
      const query = `
        SELECT 
          u.id,
          u.name,
          cp.current_rank,
          sce.cc_net,
          sce.challenges_completed,
          ra.percentile,
          ra.win_rate,
          RANK() OVER (ORDER BY sce.cc_net DESC) as position
        FROM seasonal_cc_earnings sce
        JOIN users u ON u.id = sce.user_id
        JOIN customer_profiles cp ON cp.user_id = u.id
        LEFT JOIN rank_assignments ra ON ra.user_id = u.id AND ra.season_id = sce.season_id
        WHERE sce.season_id = COALESCE($1, get_current_season())
        AND sce.cc_net > 0
        ORDER BY sce.cc_net DESC
        LIMIT $2
      `;

      const result = await this.pool.query(query, [seasonId, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting season leaderboard:', error);
      throw error;
    }
  }

  /**
   * Initialize new user with starting CC
   */
  async initializeUser(userId: string, startingBalance: number = 100): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create profile if needed
      await this.createUserProfile(userId, client);

      // Grant initial CC
      await this.credit({
        userId,
        type: 'initial_grant',
        amount: startingBalance,
        description: 'Welcome to Clubhouse Challenges!'
      });

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error initializing user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Private helper methods

  private async createUserProfile(userId: string, client?: any): Promise<void> {
    const conn = client || this.pool;
    const query = `
      INSERT INTO customer_profiles (user_id, cc_balance, current_rank)
      VALUES ($1, 0, 'house')
      ON CONFLICT (user_id) DO NOTHING
    `;
    await conn.query(query, [userId]);
  }

  private async updateSeasonalEarnings(
    userId: string,
    amount: number,
    type: string,
    client: any
  ): Promise<void> {
    const column = type.includes('bonus') ? 'cc_from_bonuses' : 'cc_from_wins';
    
    const query = `
      INSERT INTO seasonal_cc_earnings (
        user_id, season_id, ${column}, cc_net
      ) VALUES (
        $1, get_current_season(), $2, $2
      )
      ON CONFLICT (user_id, season_id) 
      DO UPDATE SET 
        ${column} = seasonal_cc_earnings.${column} + $2,
        cc_net = seasonal_cc_earnings.cc_net + $2,
        last_updated = CURRENT_TIMESTAMP
    `;
    
    await client.query(query, [userId, amount]);
  }

  private async updateSeasonalLosses(
    userId: string,
    amount: number,
    client: any
  ): Promise<void> {
    const query = `
      INSERT INTO seasonal_cc_earnings (
        user_id, season_id, cc_lost, cc_net
      ) VALUES (
        $1, get_current_season(), $2, -$2
      )
      ON CONFLICT (user_id, season_id) 
      DO UPDATE SET 
        cc_lost = seasonal_cc_earnings.cc_lost + $2,
        cc_net = seasonal_cc_earnings.cc_net - $2,
        last_updated = CURRENT_TIMESTAMP
    `;
    
    await client.query(query, [userId, amount]);
  }
}

// Export singleton instance
export default new ClubCoinService();