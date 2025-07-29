#!/usr/bin/env node
import { db } from '../utils/database';
import { logger } from '../utils/logger';

async function createAssistantKnowledgeTable() {
  try {
    // Initialize database if not already initialized
    if (!db.initialized) {
      await db.initialize();
    }
    
    console.log('Creating assistant_knowledge table...');
    
    // Create the table
    await db.query(`
      CREATE TABLE IF NOT EXISTS assistant_knowledge (
        id SERIAL PRIMARY KEY,
        assistant_id VARCHAR(255) NOT NULL,
        route VARCHAR(255) NOT NULL,
        knowledge JSONB NOT NULL,
        version VARCHAR(50) DEFAULT '1.0',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create index
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_assistant_id 
      ON assistant_knowledge(assistant_id)
    `);
    
    // Check if table was created
    const result = await db.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'assistant_knowledge'
    `);
    
    if (result.rows[0].count > 0) {
      console.log('✅ Table assistant_knowledge created successfully');
    } else {
      console.log('❌ Failed to create table');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating table:', error);
    process.exit(1);
  }
}

createAssistantKnowledgeTable();