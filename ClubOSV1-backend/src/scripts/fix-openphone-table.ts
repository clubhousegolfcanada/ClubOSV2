#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

dotenv.config();

async function fixOpenPhoneTable() {
  try {
    logger.info('Checking and fixing OpenPhone table structure...');
    
    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS openphone_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number VARCHAR(20),
        customer_name VARCHAR(255),
        employee_name VARCHAR(255),
        messages JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        processed BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}'
      )
    `);
    
    logger.info('Table exists or created');
    
    // Add missing columns one by one
    const columnsToAdd = [
      { name: 'conversation_id', type: 'VARCHAR(255) UNIQUE' },
      { name: 'updated_at', type: 'TIMESTAMP DEFAULT NOW()' },
      { name: 'unread_count', type: 'INTEGER DEFAULT 0' },
      { name: 'last_read_at', type: 'TIMESTAMP WITH TIME ZONE' }
    ];
    
    for (const column of columnsToAdd) {
      try {
        await db.query(`ALTER TABLE openphone_conversations ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`);
        logger.info(`✅ Column ${column.name} exists or added`);
      } catch (error: any) {
        logger.error(`Failed to add column ${column.name}:`, error.message);
      }
    }
    
    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_openphone_conversations_phone_number ON openphone_conversations(phone_number)',
      'CREATE INDEX IF NOT EXISTS idx_openphone_conversations_processed ON openphone_conversations(processed)',
      'CREATE INDEX IF NOT EXISTS idx_openphone_conversations_created_at ON openphone_conversations(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_openphone_conversations_updated_at ON openphone_conversations(updated_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_openphone_conversations_unread ON openphone_conversations(unread_count) WHERE unread_count > 0'
    ];
    
    for (const index of indexes) {
      try {
        await db.query(index);
        logger.info(`✅ Index created or exists`);
      } catch (error: any) {
        logger.error(`Failed to create index:`, error.message);
      }
    }
    
    // Verify final structure
    const result = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'openphone_conversations'
      ORDER BY ordinal_position
    `);
    
    logger.info('Final table structure:');
    result.rows.forEach(col => {
      logger.info(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    logger.info('✅ OpenPhone table structure fixed');
    
  } catch (error) {
    logger.error('Failed to fix OpenPhone table:', error);
  } finally {
    await db.end();
  }
}

// Run the fix
fixOpenPhoneTable().catch(console.error);