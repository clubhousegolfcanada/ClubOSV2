import { pool, query } from '../utils/db';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../utils/logger';

interface Migration {
  id: string;
  filename: string;
  executed_at: string;
}

async function createMigrationsTable(): Promise<void> {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  await query(createTableQuery);
  logger.info('Migrations table ready');
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await query('SELECT filename FROM migrations ORDER BY id ASC');
  return result.rows.map(row => row.filename);
}

async function markMigrationAsExecuted(filename: string): Promise<void> {
  await query(
    'INSERT INTO migrations (filename) VALUES ($1)',
    [filename]
  );
}

async function runMigration(filepath: string, filename: string): Promise<void> {
  logger.info(`Running migration: ${filename}`);
  
  try {
    const sql = await readFile(filepath, 'utf-8');
    
    // Split by semicolons but be careful about semicolons in strings
    const statements = sql
      .split(/;\s*$/gm)
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';');
    
    // Run each statement in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const statement of statements) {
        if (statement.trim() && !statement.match(/^\s*--/)) {
          logger.debug(`Executing: ${statement.substring(0, 50)}...`);
          await client.query(statement);
        }
      }
      
      // Mark migration as executed
      await client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [filename]
      );
      
      await client.query('COMMIT');
      logger.info(`✅ Migration ${filename} completed successfully`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error(`❌ Migration ${filename} failed:`, error);
    throw error;
  }
}

export async function runMigrations(): Promise<void> {
  try {
    logger.info('Starting database migrations...');
    
    // Ensure migrations table exists
    await createMigrationsTable();
    
    // Get list of executed migrations
    const executedMigrations = await getExecutedMigrations();
    logger.info(`Found ${executedMigrations.length} executed migrations`);
    
    // Get all migration files
    const migrationsDir = join(__dirname, '../../database/migrations');
    const files = await readdir(migrationsDir);
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Ensure migrations run in order
    
    logger.info(`Found ${sqlFiles.length} migration files`);
    
    // Run pending migrations
    let pendingCount = 0;
    for (const file of sqlFiles) {
      if (!executedMigrations.includes(file)) {
        pendingCount++;
        const filepath = join(migrationsDir, file);
        await runMigration(filepath, file);
      }
    }
    
    if (pendingCount === 0) {
      logger.info('No pending migrations to run');
    } else {
      logger.info(`✅ Successfully ran ${pendingCount} migrations`);
    }
    
  } catch (error) {
    logger.error('Migration runner failed:', error);
    throw error;
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('All migrations completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}