import { query } from './db';
import { logger } from './logger';

export async function runMigrations() {
  try {
    logger.info('Running database migrations...');
    
    // Migration 1: Add last_login column to Users table
    try {
      await query(`
        ALTER TABLE "Users" 
        ADD COLUMN IF NOT EXISTS last_login TIMESTAMP
      `);
      logger.info('✅ Migration: last_login column added/verified');
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        logger.error('Failed to add last_login column:', error);
      }
    }
    
    // Future migrations can be added here
    
    logger.info('✅ All migrations completed');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}