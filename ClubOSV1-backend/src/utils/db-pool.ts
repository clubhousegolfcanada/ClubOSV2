/**
 * @deprecated This file is deprecated. Use './db' instead which provides
 * a consolidated database connection with better performance monitoring.
 *
 * This file is kept for backward compatibility only and will be removed
 * in a future version.
 */

import { logger } from './logger';

// Re-export from the main db module to maintain compatibility
export * from './db';
export { default } from './db';

logger.warn('[DEPRECATION WARNING] db-pool.ts is deprecated. Please use db.ts instead.');