import { Pool } from 'pg';
import { pool } from '../utils/database';
import { logger } from '../utils/logger';
import { clubCoinService } from './clubCoinService';
import { notificationService } from './notificationService';
import { badgeRulesEngine } from './badgeRulesEngine';
import { rankCalculationService } from './rankCalculationService';

export interface CreateChallengeDto {
  creatorId: string;
  acceptorId: string;
  courseId?: string; // Optional for "decide later" challenges
  courseName: string;
  settingsCatalogId?: string;
  wagerAmount: number;
  expiryDays: 7 | 14 | 30;
  creatorNote?: string;
  trackmanSettings: any;
}

export interface ChallengeResponse {
  id: string;
  status: string;
  creatorId: string;
  acceptorId: string;
  wagerAmount: number;
  creatorStake: number;
  acceptorStake: number;
  totalPot: number;
  expiresAt: Date;
  trackmanSettings: any;
}

class ChallengeService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  /**
   * Create a new challenge
   */
  async createChallenge(data: CreateChallengeDto): Promise<ChallengeResponse> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Validate creator has sufficient balance for stake
      const creatorStake = Math.round(data.wagerAmount * 0.30 * 100) / 100;
      const hasBalance = await clubCoinService.hasBalance(data.creatorId, creatorStake);
      
      if (!hasBalance) {
        throw new Error(`Insufficient CC balance. Need ${creatorStake} CC for stake.`);
      }

      // Check for spam (no duplicate open challenges)
      if (data.courseId) {
        const duplicateCheck = `
          SELECT id FROM challenges
          WHERE creator_id = $1 
          AND acceptor_id = $2
          AND status IN ('pending', 'accepted', 'active')
          AND course_id = $3
        `;
        const duplicate = await client.query(duplicateCheck, [
          data.creatorId,
          data.acceptorId,
          data.courseId
        ]);

        if (duplicate.rows.length > 0) {
          throw new Error('You already have an open challenge with this opponent on this course.');
        }
      } else {
        // For "decide later" challenges, check for any duplicate open challenges with same opponent
        const duplicateCheck = `
          SELECT id FROM challenges
          WHERE creator_id = $1 
          AND acceptor_id = $2
          AND status IN ('pending', 'accepted', 'active')
          AND course_name = 'DECIDE_LATER'
        `;
        const duplicate = await client.query(duplicateCheck, [
          data.creatorId,
          data.acceptorId
        ]);

        if (duplicate.rows.length > 0) {
          throw new Error('You already have an open "decide later" challenge with this opponent.');
        }
      }

      // Create challenge
      const insertQuery = `
        INSERT INTO challenges (
          creator_id,
          acceptor_id,
          course_id,
          course_name,
          settings_catalog_id,
          wager_amount,
          expiry_days,
          creator_note,
          trackman_settings,
          status,
          tee_type,
          wind_speed,
          wind_direction,
          pin_position,
          game_mode,
          scoring_type,
          holes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending',
          $10, $11, $12, $13, $14, $15, $16
        ) RETURNING *
      `;

      const settings = data.trackmanSettings;
      const result = await client.query(insertQuery, [
        data.creatorId,
        data.acceptorId,
        data.courseId,
        data.courseName,
        data.settingsCatalogId || null,
        data.wagerAmount,
        data.expiryDays,
        data.creatorNote || null,
        JSON.stringify(settings),
        settings.teeType || null,
        settings.windSpeed || null,
        settings.windDirection || null,
        settings.pinPosition || null,
        settings.gameMode || null,
        settings.scoringType || 'stroke_play',
        settings.holes || 18
      ]);

      const challenge = result.rows[0];

      // Create stake records
      const stakeQuery = `
        INSERT INTO stakes (
          challenge_id, user_id, role, amount, percentage
        ) VALUES 
          ($1, $2, 'creator', $3, 0.30),
          ($1, $4, 'acceptor', $5, 0.70)
      `;
      await client.query(stakeQuery, [
        challenge.id,
        data.creatorId,
        challenge.creator_stake_amount,
        data.acceptorId,
        challenge.acceptor_stake_amount
      ]);

      // Log audit
      await this.logAudit(challenge.id, 'created', data.creatorId, null, 'pending', client);

      // Update challenge stats
      await this.updateChallengeStats(data.creatorId, 'created', client);

      await client.query('COMMIT');

      // Send notification to acceptor
      await this.sendChallengeNotification(
        data.acceptorId,
        'challenge_received',
        challenge
      );

      // Trigger badge checks for challenge creation
      await badgeRulesEngine.triggerEvent('challenge_created', data.creatorId, {
        challengeId: challenge.id,
        wagerAmount: data.wagerAmount
      });

      return {
        id: challenge.id,
        status: challenge.status,
        creatorId: challenge.creator_id,
        acceptorId: challenge.acceptor_id,
        wagerAmount: parseFloat(challenge.wager_amount),
        creatorStake: parseFloat(challenge.creator_stake_amount),
        acceptorStake: parseFloat(challenge.acceptor_stake_amount),
        totalPot: parseFloat(challenge.total_pot),
        expiresAt: challenge.expires_at,
        trackmanSettings: challenge.trackman_settings
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating challenge:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Accept a challenge
   */
  async acceptChallenge(challengeId: string, acceptorId: string): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get challenge details
      const challengeQuery = `
        SELECT * FROM challenges 
        WHERE id = $1 AND acceptor_id = $2 AND status = 'pending'
        FOR UPDATE
      `;
      const challengeResult = await client.query(challengeQuery, [challengeId, acceptorId]);
      
      if (challengeResult.rows.length === 0) {
        throw new Error('Challenge not found or already accepted');
      }

      const challenge = challengeResult.rows[0];

      // Validate acceptor has sufficient balance
      const acceptorStake = parseFloat(challenge.acceptor_stake_amount);
      const hasBalance = await clubCoinService.hasBalance(acceptorId, acceptorStake);
      
      if (!hasBalance) {
        throw new Error(`Insufficient CC balance. Need ${acceptorStake} CC for stake.`);
      }

      // Lock stakes (pass the client to use the same transaction)
      await clubCoinService.lockStakes(
        challengeId,
        challenge.creator_id,
        parseFloat(challenge.creator_stake_amount),
        acceptorId,
        acceptorStake,
        client  // Pass the client to use existing transaction
      );

      // Update challenge status
      const updateQuery = `
        UPDATE challenges 
        SET 
          status = 'accepted',
          accepted_at = CURRENT_TIMESTAMP,
          sent_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      await client.query(updateQuery, [challengeId]);

      // Update stakes
      const stakeUpdateQuery = `
        UPDATE stakes 
        SET is_locked = true, locked_at = CURRENT_TIMESTAMP
        WHERE challenge_id = $1
      `;
      await client.query(stakeUpdateQuery, [challengeId]);

      // Log audit
      await this.logAudit(challengeId, 'accepted', acceptorId, 'pending', 'accepted', client);

      // Update stats
      await this.updateChallengeStats(acceptorId, 'accepted', client);
      await this.updateSeasonalStats(challenge.creator_id, 'challenges_created', client);
      await this.updateSeasonalStats(acceptorId, 'challenges_accepted', client);

      await client.query('COMMIT');

      // Send notifications
      await this.sendChallengeNotification(
        challenge.creator_id,
        'challenge_accepted',
        challenge
      );

      // Trigger badge checks for challenge acceptance
      await badgeRulesEngine.triggerEvent('challenge_accepted', acceptorId, {
        challengeId: challenge.id
      });

      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error accepting challenge:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Decline a challenge
   */
  async declineChallenge(
    challengeId: string, 
    userId: string, 
    reason?: string
  ): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const updateQuery = `
        UPDATE challenges 
        SET 
          status = 'cancelled',
          decline_count = decline_count + 1,
          decline_reasons = array_append(decline_reasons, $1)
        WHERE id = $2 AND acceptor_id = $3 AND status = 'pending'
        RETURNING creator_id
      `;
      
      const result = await client.query(updateQuery, [
        reason || 'Declined by acceptor',
        challengeId,
        userId
      ]);

      if (result.rows.length === 0) {
        throw new Error('Challenge not found or cannot be declined');
      }

      // Log audit
      await this.logAudit(challengeId, 'declined', userId, 'pending', 'cancelled', client);

      await client.query('COMMIT');

      // Notify creator
      await this.sendChallengeNotification(
        result.rows[0].creator_id,
        'challenge_declined',
        { id: challengeId, reason }
      );

      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error declining challenge:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Record play session for a challenge
   */
  async recordPlay(
    challengeId: string,
    userId: string,
    trackmanRoundId: string,
    score: number,
    trackmanData: any
  ): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get challenge details
      const challengeQuery = `
        SELECT * FROM challenges 
        WHERE id = $1 AND status IN ('accepted', 'active', 'awaiting_sync')
        FOR UPDATE
      `;
      const challengeResult = await client.query(challengeQuery, [challengeId]);
      
      if (challengeResult.rows.length === 0) {
        throw new Error('Challenge not found or not active');
      }

      const challenge = challengeResult.rows[0];
      const isCreator = challenge.creator_id === userId;

      // Record play
      const playQuery = `
        INSERT INTO challenge_plays (
          challenge_id,
          user_id,
          trackman_round_id,
          score,
          trackman_data,
          is_valid
        ) VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (challenge_id, user_id) 
        DO UPDATE SET 
          trackman_round_id = $3,
          score = $4,
          trackman_data = $5,
          played_at = CURRENT_TIMESTAMP
      `;
      await client.query(playQuery, [
        challengeId,
        userId,
        trackmanRoundId,
        score,
        JSON.stringify(trackmanData)
      ]);

      // Update challenge status and scores
      let newStatus = 'awaiting_sync';
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      if (isCreator) {
        updateFields.push(`creator_played_at = CURRENT_TIMESTAMP`);
        updateFields.push(`creator_score = $${paramCount++}`);
        updateValues.push(score);
      } else {
        updateFields.push(`acceptor_played_at = CURRENT_TIMESTAMP`);
        updateFields.push(`acceptor_score = $${paramCount++}`);
        updateValues.push(score);
      }

      // Check if both have played
      if (
        (isCreator && challenge.acceptor_played_at) ||
        (!isCreator && challenge.creator_played_at)
      ) {
        newStatus = 'ready_resolve';
      }

      updateFields.push(`status = $${paramCount++}`);
      updateValues.push(newStatus);
      updateValues.push(challengeId);

      const updateQuery = `
        UPDATE challenges 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
      `;
      await client.query(updateQuery, updateValues);

      // Log audit
      await this.logAudit(challengeId, 'played', userId, challenge.status, newStatus, client);

      await client.query('COMMIT');

      // Auto-resolve if both have played
      if (newStatus === 'ready_resolve') {
        await this.resolveChallenge(challengeId);
      }

      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error recording play:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Resolve a challenge
   */
  async resolveChallenge(challengeId: string, adminId?: string): Promise<any> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get challenge with plays
      const query = `
        SELECT 
          c.*,
          cp1.score as creator_final_score,
          cp2.score as acceptor_final_score,
          cp1.trackman_round_id as creator_round_id,
          cp2.trackman_round_id as acceptor_round_id,
          prof1.current_rank as creator_rank,
          prof2.current_rank as acceptor_rank
        FROM challenges c
        LEFT JOIN challenge_plays cp1 ON cp1.challenge_id = c.id AND cp1.user_id = c.creator_id
        LEFT JOIN challenge_plays cp2 ON cp2.challenge_id = c.id AND cp2.user_id = c.acceptor_id
        LEFT JOIN customer_profiles prof1 ON prof1.user_id = c.creator_id
        LEFT JOIN customer_profiles prof2 ON prof2.user_id = c.acceptor_id
        WHERE c.id = $1
        FOR UPDATE OF c
      `;
      const result = await client.query(query, [challengeId]);
      
      if (result.rows.length === 0) {
        throw new Error('Challenge not found');
      }

      const challenge = result.rows[0];
      
      // Determine winner (lower score wins in stroke play)
      const creatorScore = parseFloat(challenge.creator_final_score || 999);
      const acceptorScore = parseFloat(challenge.acceptor_final_score || 999);
      
      let winnerId, loserId, winnerScore, loserScore;
      
      if (creatorScore < acceptorScore) {
        winnerId = challenge.creator_id;
        loserId = challenge.acceptor_id;
        winnerScore = creatorScore;
        loserScore = acceptorScore;
      } else {
        winnerId = challenge.acceptor_id;
        loserId = challenge.creator_id;
        winnerScore = acceptorScore;
        loserScore = creatorScore;
      }

      // Calculate bonuses
      const pot = parseFloat(challenge.total_pot);
      const bonuses = await this.calculateBonuses(
        pot,
        winnerId === challenge.creator_id ? challenge.creator_rank : challenge.acceptor_rank,
        winnerId === challenge.creator_id ? challenge.acceptor_rank : challenge.creator_rank,
        loserId
      );

      const totalPayout = pot + bonuses.total;

      // Create result record
      const resultQuery = `
        INSERT INTO challenge_results (
          challenge_id,
          winner_user_id,
          loser_user_id,
          winner_score,
          loser_score,
          score_difference,
          base_pot,
          rank_gap_bonus,
          champion_bonus,
          total_bonus,
          final_payout,
          winner_rank,
          loser_rank,
          resolution_type,
          resolved_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
      `;
      await client.query(resultQuery, [
        challengeId,
        winnerId,
        loserId,
        winnerScore,
        loserScore,
        Math.abs(winnerScore - loserScore),
        pot,
        bonuses.rankGap,
        bonuses.champion,
        bonuses.total,
        totalPayout,
        winnerId === challenge.creator_id ? challenge.creator_rank : challenge.acceptor_rank,
        winnerId === challenge.creator_id ? challenge.acceptor_rank : challenge.creator_rank,
        adminId ? 'admin' : 'auto',
        adminId || null
      ]);

      // Pay out winnings
      await clubCoinService.credit({
        userId: winnerId,
        type: 'challenge_win',
        amount: totalPayout,
        challengeId,
        description: `Won challenge (+${bonuses.total.toFixed(0)} CC bonus)`
      });

      // Award bonus CC if applicable (minted, not from pot)
      if (bonuses.total > 0) {
        await clubCoinService.awardBonus(
          winnerId,
          bonuses.total,
          challengeId,
          'Challenge victory bonus'
        );
      }

      // Update challenge status
      await client.query(
        `UPDATE challenges SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, 
         winner_user_id = $1, final_payout = $2 WHERE id = $3`,
        [winnerId, totalPayout, challengeId]
      );

      // Update user stats
      await this.updateWinLossStats(winnerId, loserId, client);

      // Check for badge triggers
      await this.checkBadgeTriggers(winnerId, 'challenge_win', challengeId, client);
      await this.checkBadgeTriggers(loserId, 'challenge_loss', challengeId, client);

      await client.query('COMMIT');

      // Recalculate ranks for both players
      await rankCalculationService.recalculateUserRank(winnerId);
      await rankCalculationService.recalculateUserRank(loserId);

      // Send notifications
      await this.sendChallengeNotification(winnerId, 'challenge_won', {
        challengeId,
        payout: totalPayout,
        bonus: bonuses.total
      });
      
      await this.sendChallengeNotification(loserId, 'challenge_lost', {
        challengeId,
        winnerScore,
        loserScore
      });

      return {
        winnerId,
        loserId,
        winnerScore,
        loserScore,
        pot,
        bonuses,
        totalPayout
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error resolving challenge:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user's challenges
   */
  async getUserChallenges(
    userId: string,
    status?: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      let query = `
        SELECT 
          c.*,
          u1.name as creator_name,
          u2.name as acceptor_name,
          cp1.current_rank as creator_rank,
          cp2.current_rank as acceptor_rank,
          EXISTS(
            SELECT 1 FROM champion_markers cm1 
            WHERE cm1.user_id = c.creator_id 
            AND cm1.is_active = true 
            AND (cm1.expires_at IS NULL OR cm1.expires_at > CURRENT_TIMESTAMP)
          ) as creator_has_champion,
          EXISTS(
            SELECT 1 FROM champion_markers cm2 
            WHERE cm2.user_id = c.acceptor_id 
            AND cm2.is_active = true 
            AND (cm2.expires_at IS NULL OR cm2.expires_at > CURRENT_TIMESTAMP)
          ) as acceptor_has_champion
        FROM challenges c
        JOIN users u1 ON u1.id = c.creator_id
        JOIN users u2 ON u2.id = c.acceptor_id
        LEFT JOIN customer_profiles cp1 ON cp1.user_id = c.creator_id
        LEFT JOIN customer_profiles cp2 ON cp2.user_id = c.acceptor_id
        WHERE (c.creator_id = $1 OR c.acceptor_id = $1)
      `;

      const params = [userId];
      
      if (status) {
        query += ` AND c.status = $2`;
        params.push(status);
      }

      query += ` ORDER BY c.created_at DESC LIMIT ${limit}`;

      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting user challenges:', error);
      throw error;
    }
  }

  // Private helper methods

  private async calculateBonuses(
    pot: number,
    winnerRank: string,
    loserRank: string,
    loserId: string
  ): Promise<any> {
    // Check for champion marker
    const hasChampion = await this.userHasChampionMarker(loserId);
    
    // Calculate rank gap
    const rankGap = this.getRankGap(winnerRank, loserRank);
    
    let rankGapBonus = 0;
    let championBonus = 0;

    // Rank gap bonus (only if winner is lower rank)
    if (this.isLowerRank(winnerRank, loserRank)) {
      rankGapBonus = Math.min(pot * 0.10 * rankGap, pot * 0.20);
    }

    // Champion bonus
    if (hasChampion) {
      championBonus = pot * 0.20;
    }

    return {
      rankGap: rankGapBonus,
      champion: championBonus,
      total: rankGapBonus + championBonus
    };
  }

  private async userHasChampionMarker(userId: string): Promise<boolean> {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM champion_markers 
        WHERE user_id = $1 AND is_active = true 
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      )
    `;
    const result = await this.pool.query(query, [userId]);
    return result.rows[0].exists;
  }

  private getRankGap(rank1: string, rank2: string): number {
    const ranks = ['house', 'amateur', 'bronze', 'silver', 'gold', 'pro', 'champion', 'legend'];
    const index1 = ranks.indexOf(rank1);
    const index2 = ranks.indexOf(rank2);
    return Math.abs(index1 - index2);
  }

  private isLowerRank(rank1: string, rank2: string): boolean {
    const ranks = ['house', 'amateur', 'bronze', 'silver', 'gold', 'pro', 'champion', 'legend'];
    return ranks.indexOf(rank1) < ranks.indexOf(rank2);
  }

  private async logAudit(
    challengeId: string,
    eventType: string,
    userId: string,
    oldStatus: string | null,
    newStatus: string,
    client: any
  ): Promise<void> {
    const query = `
      INSERT INTO challenge_audit (
        challenge_id, event_type, user_id, old_status, new_status
      ) VALUES ($1, $2, $3, $4, $5)
    `;
    await client.query(query, [challengeId, eventType, userId, oldStatus, newStatus]);
  }

  private async updateChallengeStats(userId: string, action: string, client: any): Promise<void> {
    const field = action === 'created' ? 'total_challenges_played' : 'total_challenges_played';
    const query = `
      UPDATE customer_profiles 
      SET ${field} = ${field} + 1, last_challenge_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;
    await client.query(query, [userId]);
  }

  private async updateSeasonalStats(userId: string, stat: string, client: any): Promise<void> {
    const query = `
      INSERT INTO seasonal_cc_earnings (user_id, season_id, ${stat})
      VALUES ($1, get_current_season(), 1)
      ON CONFLICT (user_id, season_id) 
      DO UPDATE SET ${stat} = seasonal_cc_earnings.${stat} + 1
    `;
    await client.query(query, [userId]);
  }

  private async updateWinLossStats(winnerId: string, loserId: string, client: any): Promise<void> {
    // Update winner stats
    await client.query(`
      UPDATE customer_profiles 
      SET 
        total_challenges_won = total_challenges_won + 1,
        challenge_streak = GREATEST(1, challenge_streak + 1),
        max_win_streak = GREATEST(max_win_streak, GREATEST(1, challenge_streak + 1))
      WHERE user_id = $1
    `, [winnerId]);

    // Update loser stats
    await client.query(`
      UPDATE customer_profiles 
      SET 
        challenge_streak = LEAST(-1, challenge_streak - 1),
        max_loss_streak = GREATEST(max_loss_streak, ABS(LEAST(-1, challenge_streak - 1)))
      WHERE user_id = $1
    `, [loserId]);
  }

  private async checkBadgeTriggers(
    userId: string,
    event: string,
    challengeId: string,
    client: any
  ): Promise<void> {
    try {
      // Map challenge events to badge engine events
      const badgeEvent = event === 'challenge_win' ? 'challenge_completed' : 
                        event === 'challenge_loss' ? 'challenge_completed' : event;
      
      // Trigger badge checks
      const awardedBadges = await badgeRulesEngine.triggerEvent(badgeEvent, userId, {
        challengeId,
        event
      });
      
      if (awardedBadges.length > 0) {
        logger.info(`Awarded ${awardedBadges.length} badges to user ${userId}:`, awardedBadges);
      }
    } catch (error) {
      logger.error(`Error checking badge triggers for ${userId}:`, error);
    }
  }

  private async sendChallengeNotification(
    userId: string,
    type: string,
    data: any
  ): Promise<void> {
    try {
      // Use existing notification service
      await notificationService.sendToUser(userId, {
        title: this.getNotificationTitle(type),
        body: this.getNotificationBody(type, data),
        data: {
          type: 'challenge',
          challengeId: data.id || data.challengeId,
          action: type
        }
      });
    } catch (error) {
      logger.error('Error sending challenge notification:', error);
    }
  }

  private getNotificationTitle(type: string): string {
    const titles: any = {
      challenge_received: 'New Challenge!',
      challenge_accepted: 'Challenge Accepted!',
      challenge_declined: 'Challenge Declined',
      challenge_won: 'Victory! 🏆',
      challenge_lost: 'Challenge Complete'
    };
    return titles[type] || 'Challenge Update';
  }

  private getNotificationBody(type: string, data: any): string {
    const bodies: any = {
      challenge_received: `You've been challenged! ${data.wagerAmount} CC on the line.`,
      challenge_accepted: 'Your challenge has been accepted. Game on!',
      challenge_declined: `Challenge declined. ${data.reason || 'No reason given.'}`,
      challenge_won: `You won ${data.payout} CC! ${data.bonus > 0 ? `(+${data.bonus} bonus)` : ''}`,
      challenge_lost: `Challenge complete. You scored ${data.loserScore} vs ${data.winnerScore}.`
    };
    return bodies[type] || 'Check your challenges for updates.';
  }
}

// Export singleton instance
export const challengeService = new ChallengeService();