import { pool } from '../utils/database';
import { logger } from '../utils/logger';

interface RankCutLines {
  legend: number;     // Top 1%
  champion: number;   // Top 5%
  pro: number;        // Top 10%
  gold: number;       // Top 20%
  silver: number;     // Top 35%
  bronze: number;     // Top 50%
  amateur: number;    // Top 75%
  house: number;      // Everyone else
}

class RankCalculationService {
  private readonly PERCENTILE_CUTLINES: RankCutLines = {
    legend: 99,
    champion: 95,
    pro: 90,
    gold: 80,
    silver: 65,
    bronze: 50,
    amateur: 25,
    house: 0
  };

  /**
   * Calculate and update ranks for all active users in the current season
   */
  async calculateSeasonRanks(): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current active season
      const seasonResult = await client.query(
        'SELECT id FROM seasons WHERE is_active = true LIMIT 1'
      );
      
      if (seasonResult.rows.length === 0) {
        logger.warn('No active season found for rank calculation');
        return;
      }
      
      const seasonId = seasonResult.rows[0].id;
      
      // Get all users with their CC earned this season
      const usersQuery = `
        WITH season_performance AS (
          SELECT 
            u.id as user_id,
            COALESCE(SUM(
              CASE 
                WHEN t.type IN ('challenge_win', 'challenge_refund', 'bonus_champion', 'bonus_rank_gap')
                THEN t.amount 
                ELSE 0 
              END
            ), 0) as season_cc_earned,
            COUNT(DISTINCT c.id) FILTER (WHERE c.winner_user_id = u.id) as season_wins,
            COUNT(DISTINCT c.id) FILTER (WHERE (c.creator_id = u.id OR c.acceptor_id = u.id)) as season_challenges
          FROM users u
          LEFT JOIN cc_transactions t ON t.user_id = u.id 
            AND t.created_at >= (SELECT start_date FROM seasons WHERE id = $1)
          LEFT JOIN challenges c ON (c.creator_id = u.id OR c.acceptor_id = u.id)
            AND c.created_at >= (SELECT start_date FROM seasons WHERE id = $1)
          WHERE u.role = 'customer'
          GROUP BY u.id
        ),
        ranked_users AS (
          SELECT 
            user_id,
            season_cc_earned,
            season_wins,
            season_challenges,
            PERCENT_RANK() OVER (ORDER BY season_cc_earned DESC) * 100 as percentile
          FROM season_performance
          WHERE season_challenges > 0 -- Only rank users who have participated
        )
        SELECT * FROM ranked_users
        ORDER BY percentile DESC
      `;
      
      const users = await client.query(usersQuery, [seasonId]);
      
      // Clear existing rank assignments for this season
      await client.query(
        'DELETE FROM rank_assignments WHERE season_id = $1',
        [seasonId]
      );
      
      // Assign new ranks based on percentiles
      for (const user of users.rows) {
        const rank = this.calculateRankFromPercentile(user.percentile);
        
        await client.query(
          `INSERT INTO rank_assignments 
           (user_id, season_id, rank_tier, cc_earned, percentile, calculated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [user.user_id, seasonId, rank, user.season_cc_earned, user.percentile]
        );
        
        // Update customer profile with current rank
        await client.query(
          `UPDATE customer_profiles 
           SET current_rank = $1 
           WHERE user_id = $2`,
          [rank, user.user_id]
        );
        
        // Track highest rank achieved
        await this.updateHighestRank(user.user_id, rank, client);
      }
      
      // Log rank distribution
      const distribution = await this.getRankDistribution(seasonId, client);
      logger.info('Rank calculation completed', { 
        seasonId, 
        totalRanked: users.rows.length,
        distribution 
      });
      
      await client.query('COMMIT');
      
      // Check for rank change badges
      await this.checkRankBadges(users.rows);
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error calculating ranks:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate rank tier from percentile
   */
  private calculateRankFromPercentile(percentile: number): string {
    // Percentile is inverted (100 = top, 0 = bottom)
    if (percentile >= this.PERCENTILE_CUTLINES.legend) return 'legend';
    if (percentile >= this.PERCENTILE_CUTLINES.champion) return 'champion';
    if (percentile >= this.PERCENTILE_CUTLINES.pro) return 'pro';
    if (percentile >= this.PERCENTILE_CUTLINES.gold) return 'gold';
    if (percentile >= this.PERCENTILE_CUTLINES.silver) return 'silver';
    if (percentile >= this.PERCENTILE_CUTLINES.bronze) return 'bronze';
    if (percentile >= this.PERCENTILE_CUTLINES.amateur) return 'amateur';
    return 'house';
  }

  /**
   * Update user's highest rank if new rank is higher
   */
  private async updateHighestRank(userId: string, newRank: string, client: any): Promise<void> {
    const rankOrder = {
      'legend': 8,
      'champion': 7,
      'pro': 6,
      'gold': 5,
      'silver': 4,
      'bronze': 3,
      'amateur': 2,
      'house': 1
    };
    
    const currentHighestQuery = await client.query(
      'SELECT highest_rank FROM customer_profiles WHERE user_id = $1',
      [userId]
    );
    
    const currentHighest = currentHighestQuery.rows[0]?.highest_rank || 'house';
    
    if (rankOrder[newRank as keyof typeof rankOrder] > rankOrder[currentHighest as keyof typeof rankOrder]) {
      await client.query(
        'UPDATE customer_profiles SET highest_rank = $1 WHERE user_id = $2',
        [newRank, userId]
      );
    }
  }

  /**
   * Get rank distribution for analytics
   */
  private async getRankDistribution(seasonId: string, client: any): Promise<Record<string, number>> {
    const result = await client.query(
      `SELECT rank_tier, COUNT(*) as count 
       FROM rank_assignments 
       WHERE season_id = $1 
       GROUP BY rank_tier`,
      [seasonId]
    );
    
    return result.rows.reduce((acc: any, row: any) => {
      acc[row.rank_tier] = parseInt(row.count);
      return acc;
    }, {});
  }

  /**
   * Check and award rank-related badges
   */
  private async checkRankBadges(users: any[]): Promise<void> {
    for (const user of users) {
      try {
        // Check for rank milestones
        const rank = this.calculateRankFromPercentile(user.percentile);
        
        // Gold Standard - First time reaching Gold
        if (rank === 'gold') {
          await this.awardBadgeIfNotExists(user.user_id, 'gold_standard');
        }
        
        // Pro Bono - First time reaching Pro
        if (rank === 'pro') {
          await this.awardBadgeIfNotExists(user.user_id, 'pro_bono');
        }
        
        // The Champion - First time reaching Champion
        if (rank === 'champion') {
          await this.awardBadgeIfNotExists(user.user_id, 'the_champion_rank');
        }
        
        // Living Legend - First time reaching Legend
        if (rank === 'legend') {
          await this.awardBadgeIfNotExists(user.user_id, 'living_legend');
        }
      } catch (error) {
        logger.error(`Error checking badges for user ${user.user_id}:`, error);
      }
    }
  }

  /**
   * Award badge if user doesn't already have it
   */
  private async awardBadgeIfNotExists(userId: string, badgeKey: string): Promise<void> {
    const existing = await pool.query(
      'SELECT id FROM user_badges WHERE user_id = $1 AND badge_key = $2',
      [userId, badgeKey]
    );
    
    if (existing.rows.length === 0) {
      await pool.query(
        'INSERT INTO user_badges (user_id, badge_key) VALUES ($1, $2)',
        [userId, badgeKey]
      );
      
      logger.info(`Awarded badge ${badgeKey} to user ${userId}`);
    }
  }

  /**
   * Get rank details for a specific user
   */
  async getUserRankDetails(userId: string): Promise<any> {
    const query = `
      SELECT 
        ra.rank_tier,
        ra.percentile,
        ra.cc_earned,
        ra.calculated_at,
        s.name as season_name,
        (SELECT COUNT(*) FROM rank_assignments WHERE season_id = ra.season_id) as total_ranked,
        (SELECT COUNT(*) FROM rank_assignments 
         WHERE season_id = ra.season_id AND percentile > ra.percentile) + 1 as position
      FROM rank_assignments ra
      JOIN seasons s ON s.id = ra.season_id
      WHERE ra.user_id = $1 AND s.is_active = true
      LIMIT 1
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return {
        rank_tier: 'house',
        percentile: 0,
        cc_earned: 0,
        position: null,
        total_ranked: 0
      };
    }
    
    return result.rows[0];
  }

  /**
   * Recalculate a single user's rank (used after challenge resolution)
   */
  async recalculateUserRank(userId: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current season
      const seasonResult = await client.query(
        'SELECT id FROM seasons WHERE is_active = true LIMIT 1'
      );
      
      if (seasonResult.rows.length === 0) {
        return;
      }
      
      const seasonId = seasonResult.rows[0].id;
      
      // Get user's current season performance
      const performanceQuery = `
        SELECT 
          COALESCE(SUM(
            CASE 
              WHEN type IN ('challenge_win', 'challenge_refund', 'bonus_champion', 'bonus_rank_gap')
              THEN amount 
              ELSE 0 
            END
          ), 0) as season_cc_earned
        FROM cc_transactions
        WHERE user_id = $1
        AND created_at >= (SELECT start_date FROM seasons WHERE id = $2)
      `;
      
      const performance = await client.query(performanceQuery, [userId, seasonId]);
      const ccEarned = performance.rows[0].season_cc_earned;
      
      // Calculate new percentile
      const percentileQuery = `
        WITH all_users AS (
          SELECT 
            u.id,
            COALESCE(SUM(
              CASE 
                WHEN t.type IN ('challenge_win', 'challenge_refund', 'bonus_champion', 'bonus_rank_gap')
                THEN t.amount 
                ELSE 0 
              END
            ), 0) as season_cc_earned
          FROM users u
          LEFT JOIN cc_transactions t ON t.user_id = u.id 
            AND t.created_at >= (SELECT start_date FROM seasons WHERE id = $1)
          WHERE u.role = 'customer'
          AND EXISTS (
            SELECT 1 FROM challenges c 
            WHERE (c.creator_id = u.id OR c.acceptor_id = u.id)
            AND c.created_at >= (SELECT start_date FROM seasons WHERE id = $1)
          )
          GROUP BY u.id
        )
        SELECT 
          (SELECT COUNT(*) FROM all_users WHERE season_cc_earned < $2) * 100.0 / 
          NULLIF((SELECT COUNT(*) FROM all_users), 0) as percentile
      `;
      
      const percentileResult = await client.query(percentileQuery, [seasonId, ccEarned]);
      const percentile = percentileResult.rows[0].percentile || 0;
      
      // Calculate new rank
      const newRank = this.calculateRankFromPercentile(percentile);
      
      // Update or insert rank assignment
      await client.query(
        `INSERT INTO rank_assignments (user_id, season_id, rank_tier, cc_earned, percentile, calculated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, season_id) 
         DO UPDATE SET 
           rank_tier = $3,
           cc_earned = $4,
           percentile = $5,
           calculated_at = CURRENT_TIMESTAMP`,
        [userId, seasonId, newRank, ccEarned, percentile]
      );
      
      // Update customer profile
      await client.query(
        'UPDATE customer_profiles SET current_rank = $1 WHERE user_id = $2',
        [newRank, userId]
      );
      
      await client.query('COMMIT');
      
      logger.info(`Updated rank for user ${userId}: ${newRank} (${percentile.toFixed(2)}%)`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error recalculating rank for user ${userId}:`, error);
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
export const rankCalculationService = new RankCalculationService();