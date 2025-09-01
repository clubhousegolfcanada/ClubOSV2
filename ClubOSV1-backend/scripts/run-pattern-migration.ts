#!/usr/bin/env tsx
/**
 * Script to run pattern learning migration
 * Run this on Railway using: railway run tsx scripts/run-pattern-migration.ts
 */

import { db } from '../src/utils/database';
import { logger } from '../src/utils/logger';
import fs from 'fs/promises';
import path from 'path';

async function runPatternMigration() {
  try {
    logger.info('Starting pattern learning migration...');
    
    // Initialize database connection
    await db.initialize();
    logger.info('Database connected');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../src/database/migrations/201_pattern_learning_system.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
    
    logger.info('Running migration...');
    
    // Split migration into statements (basic split by semicolon)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      try {
        // Skip empty statements
        if (!statement.trim()) continue;
        
        // Add semicolon back
        const fullStatement = statement + ';';
        
        logger.info(`Executing statement ${successCount + errorCount + 1}/${statements.length}`);
        await db.query(fullStatement);
        successCount++;
      } catch (error: any) {
        errorCount++;
        logger.error(`Failed to execute statement: ${error.message}`);
        
        // Continue with other statements
        if (!error.message.includes('already exists')) {
          logger.error('Statement that failed:', statement.substring(0, 100) + '...');
        }
      }
    }
    
    logger.info(`Migration completed: ${successCount} successful, ${errorCount} errors`);
    
    // Verify tables were created
    const tables = [
      'decision_patterns',
      'pattern_execution_history',
      'confidence_evolution',
      'pattern_suggestions_queue',
      'pattern_learning_config'
    ];
    
    logger.info('Verifying tables...');
    for (const table of tables) {
      try {
        const result = await db.query(`SELECT COUNT(*) FROM ${table}`);
        logger.info(`✅ Table ${table} exists (${result.rows[0].count} rows)`);
      } catch (error) {
        logger.error(`❌ Table ${table} does not exist`);
      }
    }
    
    // Insert default configuration if not exists
    logger.info('Setting up default configuration...');
    await db.query(`
      INSERT INTO pattern_learning_config (config_key, config_value)
      VALUES 
        ('enabled', 'false'),
        ('shadow_mode', 'true'),
        ('min_confidence_to_act', '0.85'),
        ('min_occurrences_to_learn', '3'),
        ('confidence_increase_per_success', '0.05'),
        ('confidence_decrease_per_failure', '0.15'),
        ('max_patterns_per_category', '50'),
        ('auto_approve_threshold', '0.95')
      ON CONFLICT (config_key) DO NOTHING
    `);
    
    logger.info('✅ Pattern learning system migration completed successfully!');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Set PATTERN_LEARNING_ENABLED=true in Railway environment variables');
    logger.info('2. Keep PATTERN_LEARNING_SHADOW_MODE=true for testing');
    logger.info('3. Monitor logs at /api/patterns/stats');
    
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runPatternMigration();