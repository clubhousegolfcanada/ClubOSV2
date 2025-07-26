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
    
    // Migration 3: Rename created_at columns in other tables
    const tablesToMigrate = [
      'feedback',
      'tickets', 
      'bookings',
      'access_logs',
      'auth_logs',
      'request_logs',
      'system_config',
      'customer_interactions'
    ];

    for (const tableName of tablesToMigrate) {
      try {
        // Check if created_at column exists (snake_case)
        const checkResult = await query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = '${tableName}' 
          AND column_name = 'created_at'
        `);
        
        if (checkResult.rows.length > 0) {
          logger.info(`Renaming ${tableName}.created_at to "createdAt"...`);
          
          await query(`
            ALTER TABLE ${tableName} 
            RENAME COLUMN created_at TO "createdAt"
          `);
          
          logger.info(`✅ Migration: ${tableName}.created_at renamed to "createdAt"`);
        }
        
        // Also check for updated_at column
        const checkUpdatedResult = await query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = '${tableName}' 
          AND column_name = 'updated_at'
        `);
        
        if (checkUpdatedResult.rows.length > 0) {
          logger.info(`Renaming ${tableName}.updated_at to "updatedAt"...`);
          
          await query(`
            ALTER TABLE ${tableName} 
            RENAME COLUMN updated_at TO "updatedAt"
          `);
          
          logger.info(`✅ Migration: ${tableName}.updated_at renamed to "updatedAt"`);
        }
      } catch (error: any) {
        if (!error.message.includes('does not exist') && !error.message.includes('already exists')) {
          logger.error(`Failed to migrate ${tableName} columns:`, error);
        }
      }
    }
    
    // Migration 4: Add knowledge base table
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS knowledge_base (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          category VARCHAR(50) NOT NULL,
          subcategory VARCHAR(50),
          issue VARCHAR(255) NOT NULL,
          symptoms TEXT[],
          solutions TEXT[],
          priority VARCHAR(20),
          time_estimate VARCHAR(50),
          customer_script TEXT,
          escalation_path TEXT,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await query(`CREATE INDEX IF NOT EXISTS idx_knowledge_symptoms ON knowledge_base USING GIN(symptoms)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_base(category)`);
      
      logger.info('✅ Migration: knowledge_base table created');
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        logger.error('Failed to create knowledge_base table:', error);
      }
    }
    
    // Migration 5: Add conversation sessions table
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS conversation_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id VARCHAR(255) UNIQUE NOT NULL,
          user_id UUID REFERENCES "Users"(id),
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          context JSONB,
          active BOOLEAN DEFAULT true
        )
      `);
      
      await query(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON conversation_sessions(user_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_sessions_active ON conversation_sessions(active)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON conversation_sessions(session_id)`);
      
      logger.info('✅ Migration: conversation_sessions table created');
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        logger.error('Failed to create conversation_sessions table:', error);
      }
    }
    
    // Migration 6: Add columns to customer_interactions
    try {
      await query(`
        ALTER TABLE customer_interactions 
        ADD COLUMN IF NOT EXISTS suggested_priority VARCHAR(20)
      `);
      
      await query(`
        ALTER TABLE customer_interactions 
        ADD COLUMN IF NOT EXISTS session_id VARCHAR(255)
      `);
      
      await query(`CREATE INDEX IF NOT EXISTS idx_interactions_session ON customer_interactions(session_id)`);
      
      logger.info('✅ Migration: customer_interactions columns added');
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        logger.error('Failed to add columns to customer_interactions:', error);
      }
    }
    
    logger.info('✅ All migrations completed');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}