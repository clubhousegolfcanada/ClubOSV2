import cron from 'node-cron';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

class TokenCleanupJob {
  private isRunning = false;

  /**
   * Start the token cleanup job - runs daily at 3 AM
   */
  start() {
    // Run daily at 3:00 AM
    cron.schedule('0 3 * * *', async () => {
      if (this.isRunning) {
        logger.info('Token cleanup job already running, skipping...');
        return;
      }

      await this.cleanupExpiredTokens();
    });

    logger.info('Token cleanup job scheduled to run daily at 3 AM');
    
    // Also run cleanup on startup
    this.cleanupExpiredTokens();
  }

  /**
   * Remove expired tokens from the blacklist
   */
  private async cleanupExpiredTokens() {
    this.isRunning = true;
    
    try {
      logger.info('Starting token cleanup job');
      
      // Call the cleanup function we defined in the migration
      const result = await db.query('SELECT cleanup_expired_blacklisted_tokens() as deleted_count');
      const deletedCount = result.rows[0]?.deleted_count || 0;
      
      if (deletedCount > 0) {
        logger.info(`Token cleanup completed: removed ${deletedCount} expired tokens`);
      } else {
        logger.info('Token cleanup completed: no expired tokens to remove');
      }
      
      // Also log some statistics
      const stats = await db.query(`
        SELECT 
          COUNT(*) as total_blacklisted,
          COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_blacklisted,
          MIN(blacklisted_at) as oldest_entry,
          MAX(blacklisted_at) as newest_entry
        FROM blacklisted_tokens
      `);
      
      const { total_blacklisted, active_blacklisted, oldest_entry, newest_entry } = stats.rows[0];
      
      logger.info('Token blacklist statistics', {
        totalBlacklisted: total_blacklisted,
        activeBlacklisted: active_blacklisted,
        oldestEntry: oldest_entry,
        newestEntry: newest_entry
      });
      
    } catch (error) {
      logger.error('Token cleanup job failed', { error });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger cleanup (useful for testing)
   */
  async runCleanup() {
    await this.cleanupExpiredTokens();
  }

  /**
   * Get blacklist statistics
   */
  async getStats() {
    try {
      const stats = await db.query(`
        SELECT 
          COUNT(*) as total_blacklisted,
          COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_blacklisted,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as unique_sessions,
          MIN(blacklisted_at) as oldest_entry,
          MAX(blacklisted_at) as newest_entry
        FROM blacklisted_tokens
      `);
      
      return stats.rows[0];
    } catch (error) {
      logger.error('Failed to get token blacklist stats', { error });
      return null;
    }
  }
}

// Export singleton instance
export const tokenCleanupJob = new TokenCleanupJob();