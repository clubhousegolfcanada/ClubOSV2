import { db } from '../utils/database';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

async function runSOPMigrations() {
  try {
    await db.initialize();
    logger.info('Running SOP system migrations...');

    // Create all SOP-related tables
    await db.query(`
      -- OpenPhone conversations table
      CREATE TABLE IF NOT EXISTS openphone_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number VARCHAR(20),
        customer_name VARCHAR(255),
        employee_name VARCHAR(255),
        messages JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        processed BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}'
      );

      -- Extracted knowledge table
      CREATE TABLE IF NOT EXISTS extracted_knowledge (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID,
        source_type VARCHAR(20),
        category VARCHAR(50),
        problem TEXT NOT NULL,
        solution TEXT NOT NULL,
        confidence FLOAT,
        applied_to_sop BOOLEAN DEFAULT FALSE,
        sop_file VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Shadow mode comparison table
      CREATE TABLE IF NOT EXISTS sop_shadow_comparisons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        query TEXT NOT NULL,
        route VARCHAR(50) NOT NULL,
        assistant_response TEXT,
        sop_response TEXT,
        sop_confidence FLOAT,
        assistant_time_ms INTEGER,
        sop_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- SOP embeddings table
      CREATE TABLE IF NOT EXISTS sop_embeddings (
        id VARCHAR(255) PRIMARY KEY,
        assistant VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        embedding TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- SOP metrics table
      CREATE TABLE IF NOT EXISTS sop_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE DEFAULT CURRENT_DATE,
        total_requests INTEGER DEFAULT 0,
        sop_used INTEGER DEFAULT 0,
        assistant_used INTEGER DEFAULT 0,
        sop_avg_confidence FLOAT,
        sop_avg_response_time_ms FLOAT,
        assistant_avg_response_time_ms FLOAT
      );
    `);

    logger.info('Creating indexes...');

    // Create indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_openphone_conversations_processed 
        ON openphone_conversations(processed);
      CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_category 
        ON extracted_knowledge(category);
      CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_applied 
        ON extracted_knowledge(applied_to_sop);
      CREATE INDEX IF NOT EXISTS idx_sop_embeddings_assistant 
        ON sop_embeddings(assistant);
    `);

    logger.info('✅ SOP system migrations completed successfully!');

    // Check table creation
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN (
        'openphone_conversations', 
        'extracted_knowledge', 
        'sop_shadow_comparisons',
        'sop_embeddings',
        'sop_metrics'
      )
    `);

    logger.info(`Created ${tables.rows.length} tables:`, tables.rows.map(r => r.table_name));

    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

runSOPMigrations();