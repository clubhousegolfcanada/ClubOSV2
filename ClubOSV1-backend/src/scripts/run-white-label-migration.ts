import { query as db } from '../utils/db';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  logger.debug('Checking if white label tables exist...');
  
  try {
    // Check if tables already exist
    const tableCheck = await db(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('feature_inventory', 'branding_inventory', 'sop_inventory', 'integration_inventory', 'white_label_configurations')
    `);
    
    if (tableCheck.rows.length === 5) {
      logger.debug('All white label tables already exist');
      return;
    }
    
    logger.debug(`Found ${tableCheck.rows.length}/5 tables. Creating missing tables...`);
    
    // Create tables
    await db(`
      CREATE TABLE IF NOT EXISTS white_label_configurations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        features JSONB DEFAULT '{}',
        branding JSONB DEFAULT '{}',
        sops JSONB DEFAULT '{}',
        integrations JSONB DEFAULT '{}',
        excluded_features JSONB DEFAULT '[]',
        implementation_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id)
      )
    `);
    
    await db(`
      CREATE TABLE IF NOT EXISTS feature_inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        category VARCHAR(100) NOT NULL,
        is_transferable BOOLEAN DEFAULT true,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db(`
      CREATE TABLE IF NOT EXISTS branding_inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        element_type VARCHAR(255) NOT NULL UNIQUE,
        current_value TEXT,
        is_customizable BOOLEAN DEFAULT true,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db(`
      CREATE TABLE IF NOT EXISTS sop_inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        category VARCHAR(100),
        is_industry_specific BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db(`
      CREATE TABLE IF NOT EXISTS integration_inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        type VARCHAR(100),
        is_required BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes
    await db(`CREATE INDEX IF NOT EXISTS idx_feature_inventory_category ON feature_inventory(category)`);
    await db(`CREATE INDEX IF NOT EXISTS idx_feature_inventory_transferable ON feature_inventory(is_transferable)`);
    await db(`CREATE INDEX IF NOT EXISTS idx_branding_inventory_type ON branding_inventory(element_type)`);
    await db(`CREATE INDEX IF NOT EXISTS idx_sop_inventory_category ON sop_inventory(category)`);
    await db(`CREATE INDEX IF NOT EXISTS idx_integration_inventory_type ON integration_inventory(type)`);
    
    logger.debug('White label tables created successfully');
    
    // Check if we should populate with initial data
    const featureCount = await db('SELECT COUNT(*) as count FROM feature_inventory');
    if (featureCount.rows[0].count === '0') {
      logger.debug('Tables are empty. Run populate-white-label-inventory.ts to add data.');
    }
    
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      logger.debug('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

export { runMigration };