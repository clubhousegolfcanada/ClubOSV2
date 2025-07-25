import { Pool } from 'pg';
import { logger } from './logger';

// Database connection configuration
const connectionConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait for a connection
};

// Create a connection pool
export const pool = new Pool(connectionConfig);

// Test the connection
pool.on('connect', () => {
  logger.info('Database connection established');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

// Helper function to execute queries
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', {
      text: text.substring(0, 100), // Log first 100 chars of query
      duration,
      rows: res.rowCount
    });
    return res;
  } catch (error) {
    logger.error('Database query error', {
      error,
      text: text.substring(0, 100),
      params
    });
    throw error;
  }
};

// Transaction helper
export const transaction = async <T>(
  callback: (client: any) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Graceful shutdown
export const closeDatabase = async () => {
  await pool.end();
  logger.info('Database pool closed');
};