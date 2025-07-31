import { db } from '../src/utils/database';
import { logger } from '../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration020() {
  try {
    logger.info('Running migration 020 manually...');

    // Read migration file
    const migrationPath = path.join(__dirname, '../src/database/migrations/020_fix_missing_columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolons and run each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        logger.info(`Executing: ${statement.substring(0, 50)}...`);
        await db.query(statement + ';');
        logger.info('✓ Success');
      } catch (error: any) {
        if (error.code === '42701') {
          logger.info('✓ Already exists (skipping)');
        } else {
          logger.error('✗ Failed:', error.message);
        }
      }
    }

    // Verify the changes
    const columnCheck = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'openphone_conversations'
      AND column_name IN ('unread_count', 'conversation_id', 'updated_at', 'last_read_at');
    `);

    logger.info('Verified columns after migration:');
    columnCheck.rows.forEach(col => {
      logger.info(`  ✓ ${col.column_name}`);
    });

    if (columnCheck.rows.length === 4) {
      logger.info('Migration 020 completed successfully!');
    } else {
      logger.warn('Some columns may still be missing');
    }

    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
runMigration020();