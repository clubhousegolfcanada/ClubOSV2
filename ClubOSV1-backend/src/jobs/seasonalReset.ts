import cron from 'node-cron';
import { pool } from '../utils/database';
import { logger } from '../utils/logger';
import { rankCalculationService } from '../services/rankCalculationService';

class SeasonalResetJob {
  /**
   * Start the seasonal reset job
   * Runs daily at midnight to check if season should end
   */
  start() {
    // Run every day at midnight
    cron.schedule('0 0 * * *', async () => {
      await this.checkSeasonEnd();
    });
    
    // Also check on startup
    setTimeout(async () => {
      await this.checkSeasonEnd();
    }, 5000);
    
    logger.info('Seasonal reset job scheduled (daily at midnight)');
  }

  /**
   * Check if current season should end and handle reset
   */
  async checkSeasonEnd() {
    const client = await pool.connect();
    
    try {
      // Get current active season
      const seasonResult = await client.query(
        `SELECT * FROM seasons 
         WHERE is_active = true 
         AND end_date <= CURRENT_DATE
         LIMIT 1`
      );
      
      if (seasonResult.rows.length === 0) {
        // No season to end
        return;
      }
      
      const endingSeason = seasonResult.rows[0];
      logger.info(`Season "${endingSeason.name}" has ended. Processing reset...`);
      
      await client.query('BEGIN');
      
      // Calculate final ranks before closing season
      await rankCalculationService.calculateSeasonRanks();
      
      // Archive season data
      await this.archiveSeasonData(endingSeason.id, client);
      
      // Award end-of-season badges
      await this.awardSeasonBadges(endingSeason.id, client);
      
      // Mark season as inactive
      await client.query(
        'UPDATE seasons SET is_active = false WHERE id = $1',
        [endingSeason.id]
      );
      
      // Create new season
      const newSeason = await this.createNewSeason(client);
      
      // Reset user stats for new season
      await this.resetUserStats(newSeason.id, client);
      
      await client.query('COMMIT');
      
      logger.info(`Season reset completed. New season "${newSeason.name}" started.`);
      
      // Send notifications to users
      await this.sendSeasonEndNotifications(endingSeason, newSeason);
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error in seasonal reset:', error);
    } finally {
      client.release();
    }
  }

  /**
   * Archive season data for historical tracking
   */
  private async archiveSeasonData(seasonId: string, client: any) {
    // Archive final leaderboard
    await client.query(
      `INSERT INTO season_archives (season_id, data_type, data, archived_at)
       SELECT 
         $1,
         'final_leaderboard',
         json_build_object(
           'leaderboard', json_agg(
             json_build_object(
               'user_id', ra.user_id,
               'rank', ra.rank_tier,
               'cc_earned', ra.cc_earned,
               'percentile', ra.percentile,
               'position', ROW_NUMBER() OVER (ORDER BY ra.cc_earned DESC)
             )
           )
         ),
         CURRENT_TIMESTAMP
       FROM rank_assignments ra
       WHERE ra.season_id = $1`,
      [seasonId]
    );
    
    // Archive challenge statistics
    await client.query(
      `INSERT INTO season_archives (season_id, data_type, data, archived_at)
       SELECT 
         $1,
         'challenge_stats',
         json_build_object(
           'total_challenges', COUNT(*),
           'total_cc_wagered', SUM(wager_amount),
           'avg_wager', AVG(wager_amount),
           'total_disputes', COUNT(*) FILTER (WHERE status = 'disputed')
         ),
         CURRENT_TIMESTAMP
       FROM challenges
       WHERE created_at >= (SELECT start_date FROM seasons WHERE id = $1)
       AND created_at <= (SELECT end_date FROM seasons WHERE id = $1)`,
      [seasonId]
    );
    
    logger.info(`Archived data for season ${seasonId}`);
  }

  /**
   * Award end-of-season badges
   */
  private async awardSeasonBadges(seasonId: string, client: any) {
    // Get top performers
    const topPerformers = await client.query(
      `SELECT 
         ra.user_id,
         ra.rank_tier,
         ra.cc_earned,
         ROW_NUMBER() OVER (ORDER BY ra.cc_earned DESC) as position
       FROM rank_assignments ra
       WHERE ra.season_id = $1
       ORDER BY ra.cc_earned DESC
       LIMIT 10`,
      [seasonId]
    );
    
    for (const performer of topPerformers.rows) {
      // The Tax Man - Most CC won in a season (#1)
      if (performer.position === 1) {
        await this.awardBadge(performer.user_id, 'the_tax_man', client, {
          season_id: seasonId,
          cc_earned: performer.cc_earned
        });
      }
      
      // Season badges based on final rank
      if (performer.rank_tier === 'legend') {
        await this.awardBadge(performer.user_id, 'season_legend', client, {
          season_id: seasonId
        });
      } else if (performer.rank_tier === 'master') {
        await this.awardBadge(performer.user_id, 'season_master', client, {
          season_id: seasonId
        });
      }
    }
    
    // Award participation badges
    const participants = await client.query(
      `SELECT DISTINCT user_id
       FROM challenges
       WHERE created_at >= (SELECT start_date FROM seasons WHERE id = $1)
       AND created_at <= (SELECT end_date FROM seasons WHERE id = $1)`,
      [seasonId]
    );
    
    for (const participant of participants.rows) {
      // Season participant badge
      await this.awardBadge(participant.user_id, 'season_participant', client, {
        season_id: seasonId
      });
    }
    
    logger.info(`Awarded season badges for ${participants.rows.length} participants`);
  }

  /**
   * Award badge to user if they don't have it
   */
  private async awardBadge(userId: string, badgeKey: string, client: any, metadata?: any) {
    try {
      // Check if badge exists in catalog
      const badgeCheck = await client.query(
        'SELECT 1 FROM badges WHERE key = $1',
        [badgeKey]
      );
      
      if (badgeCheck.rows.length === 0) {
        // Badge doesn't exist in catalog, skip
        return;
      }
      
      // Check if user already has this badge for this season
      const existing = await client.query(
        'SELECT 1 FROM user_badges WHERE user_id = $1 AND badge_key = $2',
        [userId, badgeKey]
      );
      
      if (existing.rows.length === 0) {
        await client.query(
          'INSERT INTO user_badges (user_id, badge_key, metadata) VALUES ($1, $2, $3)',
          [userId, badgeKey, metadata || {}]
        );
        
        logger.info(`Awarded ${badgeKey} to user ${userId}`);
      }
    } catch (error) {
      logger.error(`Error awarding badge ${badgeKey} to user ${userId}:`, error);
    }
  }

  /**
   * Create a new season
   */
  private async createNewSeason(client: any): Promise<any> {
    // Calculate new season dates (3 months by default)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 3);
    
    // Generate season name based on quarter and year
    const quarter = Math.floor(startDate.getMonth() / 3) + 1;
    const year = startDate.getFullYear();
    const seasonName = `Q${quarter} ${year}`;
    
    const result = await client.query(
      `INSERT INTO seasons (name, start_date, end_date, is_active, config)
       VALUES ($1, $2, $3, true, $4)
       RETURNING *`,
      [
        seasonName,
        startDate,
        endDate,
        {
          duration_months: 3,
          rank_calculation_frequency: 'daily',
          minimum_challenges_for_rank: 3,
          cc_starting_balance: 100
        }
      ]
    );
    
    logger.info(`Created new season: ${seasonName}`);
    return result.rows[0];
  }

  /**
   * Reset user stats for new season
   */
  private async resetUserStats(seasonId: string, client: any) {
    // Give all active users starting CC balance
    const startingBalance = 100;
    
    const activeUsers = await client.query(
      `SELECT DISTINCT u.id
       FROM "Users" u
       JOIN customer_profiles cp ON cp.user_id = u.id
       WHERE u.role = 'customer'
       AND u.is_active = true`
    );
    
    for (const user of activeUsers.rows) {
      // Credit starting balance
      await client.query(
        `INSERT INTO cc_transactions (user_id, type, amount, description)
         VALUES ($1, 'season_start_bonus', $2, $3)`,
        [user.id, startingBalance, `Season start bonus for ${seasonId}`]
      );
      
      // Update CC balance
      await client.query(
        `UPDATE customer_profiles 
         SET cc_balance = cc_balance + $1
         WHERE user_id = $2`,
        [startingBalance, user.id]
      );
      
      // Reset current rank to house
      await client.query(
        `UPDATE customer_profiles 
         SET current_rank = 'house'
         WHERE user_id = $1`,
        [user.id]
      );
      
      // Create initial rank assignment
      await client.query(
        `INSERT INTO rank_assignments (user_id, season_id, rank_tier, cc_earned, percentile)
         VALUES ($1, $2, 'house', 0, 0)`,
        [user.id, seasonId]
      );
    }
    
    logger.info(`Reset stats for ${activeUsers.rows.length} users`);
  }

  /**
   * Send notifications about season end
   */
  private async sendSeasonEndNotifications(oldSeason: any, newSeason: any) {
    try {
      // Get all participants from ended season
      const participants = await pool.query(
        `SELECT DISTINCT u.id, u.email, u.name, ra.rank_tier, ra.cc_earned
         FROM "Users" u
         JOIN rank_assignments ra ON ra.user_id = u.id
         WHERE ra.season_id = $1`,
        [oldSeason.id]
      );
      
      // Here you would integrate with your notification service
      // For now, just log
      logger.info(`Would send season end notifications to ${participants.rows.length} users`);
      
      // Example notification structure:
      for (const user of participants.rows) {
        const notification = {
          userId: user.id,
          title: `Season "${oldSeason.name}" has ended!`,
          body: `You finished at ${user.rank_tier} rank with ${user.cc_earned} CC earned. New season "${newSeason.name}" has begun with 100 CC starting bonus!`,
          type: 'season_end',
          data: {
            old_season_id: oldSeason.id,
            new_season_id: newSeason.id,
            final_rank: user.rank_tier,
            cc_earned: user.cc_earned
          }
        };
        
        // TODO: Send actual notification
        // await notificationService.send(notification);
      }
    } catch (error) {
      logger.error('Error sending season end notifications:', error);
    }
  }

  /**
   * Manually trigger season end (for testing)
   */
  async forceSeasonEnd() {
    logger.info('Manually triggering season end...');
    await this.checkSeasonEnd();
  }
}

// Export singleton instance
export default new SeasonalResetJob();