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
    // Migration 2: Rename Users table columns to camelCase
    try {
      // Check if columns need renaming by checking if created_at exists
      const checkResult = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'Users' 
        AND column_name = 'created_at'
      `);
      
      if (checkResult.rows.length > 0) {
        logger.info('Renaming Users table columns to camelCase...');
        
        // Rename columns from snake_case to camelCase
        await query(`
          ALTER TABLE "Users" 
          RENAME COLUMN created_at TO "createdAt"
        `);
        
        await query(`
          ALTER TABLE "Users" 
          RENAME COLUMN updated_at TO "updatedAt"
        `);
        
        await query(`
          ALTER TABLE "Users" 
          RENAME COLUMN is_active TO "isActive"
        `);
        
        await query(`
          ALTER TABLE "Users" 
          RENAME COLUMN last_login TO "lastLogin"
        `);
        
        logger.info('✅ Migration: Users columns renamed to camelCase');
      } else {
        logger.info('✅ Migration: Users columns already in camelCase');
      }
    } catch (error: any) {
      if (!error.message.includes('does not exist')) {
        logger.error('Failed to rename columns:', error);
      }
    }
