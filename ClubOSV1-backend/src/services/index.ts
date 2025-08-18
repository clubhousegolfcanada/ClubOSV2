/**
 * Service exports with caching layer
 * This file provides a central place to import services
 * and enables/disables caching based on environment
 */

import { LLMService } from './llmService';
import { CachedLLMService } from './llmServiceCached';
import { cacheService } from './cacheService';
import { usageTrackingService } from './usageTrackingService';
import { logger } from '../utils/logger';

// Check if caching should be enabled
const ENABLE_CACHING = process.env.ENABLE_CACHING !== 'false'; // Default to true
const ENABLE_USAGE_TRACKING = process.env.ENABLE_USAGE_TRACKING !== 'false'; // Default to true

// Export the appropriate LLM service based on configuration
export const llmService = ENABLE_CACHING 
  ? CachedLLMService.getInstance()
  : LLMService.getInstance();

// Export cache service
export { cacheService };

// Export usage tracking
export { usageTrackingService };

// Log configuration on startup
if (ENABLE_CACHING) {
  logger.info('🚀 Caching enabled for LLM services');
} else {
  logger.info('⚠️ Caching disabled for LLM services');
}

if (ENABLE_USAGE_TRACKING) {
  logger.info('📊 Usage tracking enabled');
} else {
  logger.info('⚠️ Usage tracking disabled');
}

// Initialize cache stats tracking
if (ENABLE_CACHING) {
  setInterval(() => {
    const stats = cacheService.getStats();
    if (stats.hits + stats.misses > 0) {
      logger.debug('Cache statistics', {
        hitRate: `${stats.hitRate}%`,
        hits: stats.hits,
        misses: stats.misses,
        errors: stats.errors
      });
    }
  }, 60000); // Log stats every minute
}