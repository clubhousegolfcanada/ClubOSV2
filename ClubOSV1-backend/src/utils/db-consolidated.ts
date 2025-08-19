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
  max: 20, // Increased from 10 for better concurrency
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // Additional performance settings
  statement_timeout: 30000, // 30 second query timeout
  query_timeout: 30000,
});

// Performance metrics collection
const queryMetrics: QueryMetrics[] = [];
const MAX_METRICS_HISTORY = 1000;

// Pool event monitoring
pool.on('error', (err) => {
  logger.error('Database pool error:', err);
});

pool.on('connect', (client) => {
  logger.debug('New database client connected');
});

pool.on('acquire', () => {
  const activeCount = pool.totalCount - pool.idleCount;
  if (activeCount > 15) {
    logger.warn(`High database connection usage: ${activeCount}/${pool.totalCount} connections active`);
  }
});

// Enhanced query function with performance logging
export async function query(text: string, params?: any[]): Promise<any> {
  const start = Date.now();
  const queryId = Math.random().toString(36).substring(7);
  
  try {
    logger.debug(`[Query ${queryId}] Starting`, { text: text.substring(0, 100) });
    
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
  }
}

// Transaction helper with automatic rollback
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
    client.release();
  }
}

// Get performance statistics
export function getQueryStats() {
  if (queryMetrics.length === 0) {
    return {
      totalQueries: 0,
      avgDuration: 0,
      slowQueries: 0,
      recentQueries: []
    };
  }
  
  const totalDuration = queryMetrics.reduce((sum, m) => sum + m.duration, 0);
  const slowQueries = queryMetrics.filter(m => m.duration > 1000).length;
  
  return {
    totalQueries: queryMetrics.length,
    avgDuration: Math.round(totalDuration / queryMetrics.length),
    slowQueries,
    slowQueryPercentage: ((slowQueries / queryMetrics.length) * 100).toFixed(2),
    recentQueries: queryMetrics.slice(-10).map(m => ({
      query: m.text.substring(0, 50) + '...',
      duration: m.duration,
      rows: m.rows,
      timestamp: m.timestamp
    }))
  };
}

// Health check
export async function checkHealth(): Promise<boolean> {
  try {
    const result = await query('SELECT 1 as health');
    return result.rows[0].health === 1;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function close(): Promise<void> {
  logger.info('Closing database pool...');
  await pool.end();
  logger.info('Database pool closed');
}

// Export pool for advanced use cases
export { pool };

// Default export for backward compatibility
export default {
  query,
  transaction,
  getQueryStats,
  checkHealth,
  close,
  pool
};