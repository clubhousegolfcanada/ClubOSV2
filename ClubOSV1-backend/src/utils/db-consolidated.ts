import { Pool, PoolClient } from 'pg';
import { logger } from './logger';

// Performance monitoring interface
interface QueryMetrics {
  text: string;
  duration: number;
  rows: number;
  timestamp: Date;
}

// Create a single connection pool instance
// Use explicit Railway URL if DATABASE_URL is not set (happens when modules load before dotenv)
const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway';

const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes('railway') ? { rejectUnauthorized: false } : false,
  max: 50, // Increased from 20 to handle more concurrent connections
  idleTimeoutMillis: 10000, // Reduced from 30000 to release idle connections faster
  connectionTimeoutMillis: 5000, // Increased from 2000
  // Additional performance settings
  statement_timeout: 30000, // 30 second query timeout
  query_timeout: 30000,
  allowExitOnIdle: true, // Allow process to exit if pool is idle
});

// Performance metrics collection
const queryMetrics: QueryMetrics[] = [];
const MAX_METRICS_HISTORY = 1000;

// Connection tracking for debugging
let activeQueries = 0;
let totalQueries = 0;

// Pool event monitoring
pool.on('error', (err) => {
  logger.error('Database pool error:', err);
});

pool.on('connect', (client) => {
  logger.debug('New database client connected');
});

pool.on('acquire', () => {
  const activeCount = pool.totalCount - pool.idleCount;
  const waitingCount = pool.waitingCount;
  
  // Log warning at lower threshold
  if (activeCount > pool.totalCount * 0.7) {
    logger.warn(`High database connection usage: ${activeCount}/${pool.totalCount} connections active, ${waitingCount} waiting`);
  }
  
  // Log critical if at max
  if (activeCount >= pool.totalCount - 1) {
    logger.error(`CRITICAL: Database connection pool nearly exhausted: ${activeCount}/${pool.totalCount} active, ${waitingCount} waiting`);
  }
});

pool.on('remove', () => {
  logger.debug('Database client removed from pool');
});

// Enhanced query function with performance logging and connection management
export async function query(text: string, params?: any[]): Promise<any> {
  const start = Date.now();
  const queryId = Math.random().toString(36).substring(7);
  
  activeQueries++;
  totalQueries++;
  
  try {
    // Log pool status periodically
    if (totalQueries % 100 === 0) {
      logger.info('Database pool status', {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
        activeQueries,
        totalQueries
      });
    }
    
    logger.debug(`[Query ${queryId}] Starting`, { 
      text: text.substring(0, 100),
      activeQueries 
    });
    
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log performance metrics
    const metrics: QueryMetrics = {
      text: text.substring(0, 200),
      duration,
      rows: result.rowCount || 0,
      timestamp: new Date()
    };
    
    // Store metrics for analysis
    queryMetrics.push(metrics);
    if (queryMetrics.length > MAX_METRICS_HISTORY) {
      queryMetrics.shift();
    }
    
    // Log slow queries
    if (duration > 1000) {
      logger.warn(`[Query ${queryId}] Slow query detected`, {
        duration,
        query: text.substring(0, 200),
        params: params?.slice(0, 3) // Log first 3 params only
      });
    } else if (duration > 100) {
      logger.debug(`[Query ${queryId}] Completed`, { duration, rows: result.rowCount });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`[Query ${queryId}] Failed`, {
      error,
      duration,
      query: text.substring(0, 200)
    });
    throw error;
  } finally {
    activeQueries--;
  }
}

// Transaction helper with automatic rollback and proper client release
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  const transactionId = Math.random().toString(36).substring(7);
  
  try {
    logger.debug(`[Transaction ${transactionId}] Starting`);
    await client.query('BEGIN');
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    logger.debug(`[Transaction ${transactionId}] Committed`);
    
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`[Transaction ${transactionId}] Rolled back`, { error });
    throw error;
  } finally {
    // IMPORTANT: Always release the client back to the pool
    client.release();
    logger.debug(`[Transaction ${transactionId}] Client released`);
  }
}

// Get pool statistics
export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    active: pool.totalCount - pool.idleCount,
    activeQueries,
    totalQueries,
    metrics: {
      recentQueries: queryMetrics.slice(-10),
      slowQueries: queryMetrics.filter(m => m.duration > 1000).slice(-10),
      averageDuration: queryMetrics.reduce((acc, m) => acc + m.duration, 0) / queryMetrics.length || 0
    }
  };
}

// Graceful shutdown with proper pool drainage
export async function closePool(): Promise<void> {
  try {
    logger.info('Closing database pool...');
    await pool.end();
    logger.info('Database pool closed successfully');
  } catch (error) {
    logger.error('Error closing database pool:', error);
    throw error;
  }
}

// Health check with connection test
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await query('SELECT 1 as health');
    return result.rows[0]?.health === 1;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}

// Export the pool for direct access if needed (use with caution)
export { pool };

// Default export for backward compatibility
export default {
  query,
  transaction,
  getPoolStats,
  closePool,
  healthCheck,
  pool
};