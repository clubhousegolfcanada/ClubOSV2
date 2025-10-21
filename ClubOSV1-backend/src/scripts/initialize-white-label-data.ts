import { query as db } from '../utils/db';
import { populateInventory } from './populate-white-label-inventory';

export async function initializeWhiteLabelData() {
  try {
    // Check if we have any data
    const featureCount = await db('SELECT COUNT(*) as count FROM feature_inventory');
    
    if (featureCount.rows[0].count === '0') {
      logger.debug('White label inventory is empty. Populating with initial data...');
      await populateInventory();
      logger.debug('White label inventory populated successfully');
    } else {
      logger.debug(`White label inventory already contains ${featureCount.rows[0].count} features`);
    }
  } catch (error) {
    logger.error('Failed to initialize white label data:', error);
    // Don't throw - this is not critical for app startup
  }
}