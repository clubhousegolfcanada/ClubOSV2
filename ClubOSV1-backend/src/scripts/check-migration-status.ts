import * as dotenv from 'dotenv';
dotenv.config();

import { pool } from '../utils/db';
import { logger } from '../utils/logger';

async function checkMigrationStatus() {
  const client = await pool.connect();
  
  try {
    logger.info('Checking migration status...');
    
    // Check migrations table
    const migrations = await client.query(
      'SELECT filename, executed_at FROM migrations ORDER BY id DESC LIMIT 10'
    );
    
    logger.info('Last 10 migrations executed:');
    migrations.rows.forEach(row => {
      logger.info(`  - ${row.filename} at ${row.executed_at}`);
    });
    
    // Check if specific tables exist
    const tableChecks = [
      'ai_automation_response_tracking',
      'openphone_conversations'
    ];
    
    for (const tableName of tableChecks) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )`,
        [tableName]
      );
      logger.info(`Table ${tableName} exists: ${result.rows[0].exists}`);
    }
    
    // Check if specific columns exist
    const columnChecks = [
      { table: 'openphone_conversations', column: 'assistant_type' },
      { table: 'openphone_conversations', column: 'last_assistant_type' },
      { table: 'extracted_knowledge', column: 'metadata' }
    ];
    
    for (const check of columnChecks) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = $2
        )`,
        [check.table, check.column]
      );
      logger.info(`Column ${check.table}.${check.column} exists: ${result.rows[0].exists}`);
    }
    
    // Check for failed migrations
    const migrationFiles = [
      '048_create_response_tracking_table.sql',
      '049_add_assistant_type_columns.sql',
      '050_lower_gift_card_confidence.sql'
    ];
    
    for (const filename of migrationFiles) {
      const result = await client.query(
        'SELECT * FROM migrations WHERE filename = $1',
        [filename]
      );
      if (result.rows.length === 0) {
        logger.warn(`Migration ${filename} has NOT been executed!`);
      } else {
        logger.info(`Migration ${filename} executed at ${result.rows[0].executed_at}`);
      }
    }
    
  } catch (error) {
    logger.error('Error checking migration status:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

checkMigrationStatus();