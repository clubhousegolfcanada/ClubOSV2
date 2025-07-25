import * as dotenv from 'dotenv';
dotenv.config();

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
    
    logger.info(`Total statements found: ${statements.length}`);
    statements.forEach((stmt, idx) => {
      logger.info(`Statement ${idx + 1}: ${stmt.substring(0, 100)}...`);
    });
    
    // Run each statement WITHOUT a transaction to ensure tables are created before indexes
    const client = await pool.connect();
    try {
      // Don't use a transaction - execute each statement individually
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim() && !statement.match(/^\s*--/)) {
          logger.info(`Executing statement ${i + 1}/${statements.length}: ${statement.substring(0, 80)}...`);
          try {
            await client.query(statement);
            logger.info(`✓ Statement ${i + 1} executed successfully`);
          } catch (stmtError) {
            logger.error(`✗ Statement ${i + 1} failed:`, statement);
            throw stmtError;
          }
        }
      }
      
      // Mark migration as executed
      await client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [filename]
      );
      
      logger.info(`✅ Migration ${filename} completed successfully`);
    } catch (error) {
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
    const migrationsDir = join(__dirname, '../database/migrations');
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
  // Debug: Check if DATABASE_URL is loaded
  console.log('DATABASE_URL loaded:', process.env.DATABASE_URL ? 'Yes' : 'No');
  console.log('Current directory:', process.cwd());
  
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