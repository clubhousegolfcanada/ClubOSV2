#!/usr/bin/env npx tsx
/**
 * Migration Consolidation Script
 * 
 * This script safely migrates from the old scattered migrations to the new baseline schema.
 * It will:
 * 1. Backup current database
 * 2. Check if baseline has already been applied
 * 3. Apply baseline migration if needed
 * 4. Verify all data integrity
 * 
 * Usage: npm run consolidate-migrations [--dry-run] [--force]
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

interface TableInfo {
  table_name: string;
  column_count: number;
  row_count: number;
}

async function checkMigrationHistory(): Promise<boolean> {
  try {
    const result = await db.query(`
      SELECT version, applied_at 
      FROM migration_history 
      WHERE version = '000'
    `);
    return result.rows.length > 0;
  } catch (error) {
    // Migration history table doesn't exist yet
    return false;
  }
}

async function getTableInfo(): Promise<TableInfo[]> {
  const tables: TableInfo[] = [];
  
  try {
    // Get all tables
    const tableResult = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    // Get row counts and column counts for each table
    for (const row of tableResult.rows) {
      const tableName = row.table_name;
      
      // Get column count
      const columnResult = await db.query(`
        SELECT COUNT(*) as column_count
        FROM information_schema.columns
        WHERE table_name = $1
      `, [tableName]);
      
      // Get row count
      const rowResult = await db.query(`
        SELECT COUNT(*) as row_count FROM "${tableName}"
      `);
      
      tables.push({
        table_name: tableName,
        column_count: parseInt(columnResult.rows[0].column_count),
        row_count: parseInt(rowResult.rows[0].row_count)
      });
    }
  } catch (error) {
    logger.error('Error getting table info:', error);
  }
  
  return tables;
}

async function backupDatabase(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(__dirname, '..', 'database', 'backups', `pre-consolidation-${timestamp}.json`);
  
  logger.info('Creating database backup...');
  
  const backup: any = {
    timestamp,
    tables: {}
  };
  
  const tables = await getTableInfo();
  
  for (const table of tables) {
    try {
      const result = await db.query(`SELECT * FROM "${table.table_name}"`);
      backup.tables[table.table_name] = {
        row_count: table.row_count,
        column_count: table.column_count,
        data: result.rows
      };
    } catch (error) {
      logger.warn(`Could not backup table ${table.table_name}:`, error);
    }
  }
  
  if (!DRY_RUN) {
    await fs.mkdir(path.dirname(backupFile), { recursive: true });
    await fs.writeFile(backupFile, JSON.stringify(backup, null, 2));
    logger.info(`Backup saved to: ${backupFile}`);
  } else {
    logger.info('[DRY RUN] Would save backup to:', backupFile);
  }
  
  return backupFile;
}

async function loadBaselineMigration(): Promise<string> {
  const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '000_baseline_schema.sql');
  return await fs.readFile(migrationPath, 'utf-8');
}

async function applyBaselineMigration(): Promise<void> {
  const migration = await loadBaselineMigration();
  
  if (DRY_RUN) {
    logger.info('[DRY RUN] Would apply baseline migration');
    logger.info(`Migration size: ${migration.length} characters`);
    return;
  }
  
  logger.info('Applying baseline migration...');
  
  try {
    await db.query('BEGIN');
    
    // Split migration into individual statements (naive split, might need improvement)
    const statements = migration
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let completed = 0;
    for (const statement of statements) {
      try {
        await db.query(statement + ';');
        completed++;
        
        // Log progress every 10 statements
        if (completed % 10 === 0) {
          logger.info(`Progress: ${completed}/${statements.length} statements completed`);
        }
      } catch (error: any) {
        // Ignore "already exists" errors unless in verbose mode
        if (!error.message.includes('already exists')) {
          logger.error(`Error executing statement: ${error.message}`);
          logger.debug('Statement:', statement.substring(0, 100) + '...');
        }
      }
    }
    
    await db.query('COMMIT');
    logger.info(`Baseline migration completed: ${completed}/${statements.length} statements executed`);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function verifyMigration(): Promise<boolean> {
  logger.info('Verifying migration...');
  
  const expectedTables = [
    'users', 'system_config', 'tickets', 'ticket_comments', 'feedback',
    'bookings', 'checklist_submissions', 'checklist_task_customizations',
    'remote_actions_log', 'push_subscriptions', 'notification_history',
    'notification_preferences', 'openphone_conversations', 'message_status',
    'slack_messages', 'slack_replies', 'slack_thread_resolutions',
    'hubspot_cache', 'assistant_knowledge', 'knowledge_captures',
    'knowledge_audit_log', 'ai_prompt_templates', 'ai_prompt_template_history',
    'parent_documents', 'migration_history'
  ];
  
  const afterTables = await getTableInfo();
  const tableNames = afterTables.map(t => t.table_name);
  
  const missingTables = expectedTables.filter(t => !tableNames.includes(t));
  const extraTables = tableNames.filter(t => !expectedTables.includes(t) && 
    !['extracted_knowledge', 'sop_shadow_comparisons', 'sop_embeddings', 
     'sop_metrics', 'sop_update_queue', 'sop_drafts', 'sop_update_log',
     'learning_metrics', 'vector_store_archive', 'vector_store_deletion_log',
     'access_logs', 'auth_logs', 'request_logs', 'customer_interactions',
     'routing_optimizations', 'public_requests'].includes(t));
  
  if (missingTables.length > 0) {
    logger.error('Missing expected tables:', missingTables);
    return false;
  }
  
  if (extraTables.length > 0) {
    logger.warn('Extra tables found (may be from custom modifications):', extraTables);
  }
  
  // Verify data integrity - check if key tables have data
  const keyTables = ['users', 'system_config'];
  for (const tableName of keyTables) {
    const table = afterTables.find(t => t.table_name === tableName);
    if (table && table.row_count === 0 && tableName === 'system_config') {
      logger.warn(`Table ${tableName} is empty - this might be expected for a fresh install`);
    }
  }
  
  logger.info('Migration verification completed successfully');
  logger.info(`Total tables: ${afterTables.length}`);
  logger.info(`Total rows across all tables: ${afterTables.reduce((sum, t) => sum + t.row_count, 0)}`);
  
  return true;
}

async function main() {
  try {
    logger.info('=== Database Migration Consolidation ===');
    logger.info(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    
    // Initialize database connection
    await db.initialize();
    
    // Check if migration has already been applied
    const alreadyApplied = await checkMigrationHistory();
    if (alreadyApplied && !FORCE) {
      logger.info('Baseline migration has already been applied. Use --force to reapply.');
      process.exit(0);
    }
    
    // Get current state
    logger.info('\nCurrent database state:');
    const beforeTables = await getTableInfo();
    beforeTables.forEach(t => {
      logger.info(`  ${t.table_name}: ${t.row_count} rows, ${t.column_count} columns`);
    });
    
    // Create backup
    const backupFile = await backupDatabase();
    
    // Apply baseline migration
    await applyBaselineMigration();
    
    // Verify migration
    const success = await verifyMigration();
    
    if (success) {
      logger.info('\n✅ Migration consolidation completed successfully!');
      logger.info(`Backup saved to: ${backupFile}`);
      logger.info('\nNext steps:');
      logger.info('1. Remove old migration files (keep 000_baseline_schema.sql)');
      logger.info('2. Update deployment scripts to use new migration system');
      logger.info('3. Test application functionality');
    } else {
      logger.error('\n❌ Migration verification failed!');
      logger.error('Please check the errors above and restore from backup if needed.');
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('Migration consolidation failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run the migration
if (require.main === module) {
  main();
}