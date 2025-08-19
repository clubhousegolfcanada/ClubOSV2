import cron from 'node-cron';
import { logger } from '../utils/logger';
import { rankCalculationService } from '../services/rankCalculationService';

class RankCalculationJob {
  /**
   * Start the rank calculation job
   * Runs every 6 hours to update ranks based on current season performance
   */
  start() {
    // Run every 6 hours at minute 30
    cron.schedule('30 */6 * * *', async () => {
      logger.info('Starting scheduled rank calculation...');
      
      try {
        await rankCalculationService.calculateSeasonRanks();
        logger.info('Scheduled rank calculation completed successfully');
      } catch (error) {
        logger.error('Error in scheduled rank calculation:', error);
      }
    });
    
    // Also run immediately on startup for testing
    setTimeout(async () => {
      logger.info('Running initial rank calculation...');
      try {
        await rankCalculationService.calculateSeasonRanks();
        logger.info('Initial rank calculation completed');
      } catch (error) {
        logger.error('Error in initial rank calculation:', error);
      }
    }, 10000); // Wait 10 seconds after startup
    
    logger.info('Rank calculation job scheduled (every 6 hours)');
  }
}

// Export singleton instance
export default new RankCalculationJob();