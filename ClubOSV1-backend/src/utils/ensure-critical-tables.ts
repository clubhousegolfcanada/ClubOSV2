import { logger } from './logger';
import { db } from './database';

export async function ensureCriticalTables(): Promise<void> {
  logger.info('Ensuring critical tables exist...');
  
  try {
    // Create ai_automation_features table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_automation_features (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feature_key VARCHAR(100) UNIQUE NOT NULL,
        feature_name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL,
        enabled BOOLEAN DEFAULT false,
        config JSONB DEFAULT '{}',
        required_permissions VARCHAR(50)[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        allow_follow_up BOOLEAN DEFAULT true
      )
    `);
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_automation_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feature_id UUID REFERENCES ai_automation_features(id),
        conversation_id UUID,
        trigger_type VARCHAR(50),
        input_data JSONB,
        output_data JSONB,
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        execution_time_ms INTEGER,
        user_confirmed BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_automation_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feature_id UUID REFERENCES ai_automation_features(id),
        rule_type VARCHAR(50),
        rule_data JSONB NOT NULL,
        priority INTEGER DEFAULT 100,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create indexes
    await db.query('CREATE INDEX IF NOT EXISTS idx_ai_features_enabled ON ai_automation_features(enabled)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_ai_features_category ON ai_automation_features(category)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ai_automation_usage(feature_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_automation_usage(created_at DESC)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_ai_rules_feature ON ai_automation_rules(feature_id)');
    
    // Insert initial features if they don't exist
    await db.query(`
      INSERT INTO ai_automation_features (feature_key, feature_name, description, category, enabled, config, required_permissions) 
      SELECT * FROM (VALUES
        ('gift_cards', 'Gift Card Inquiries', 'Automatically respond to gift card purchase questions with link to purchase page', 'customer_service', false, 
          '{"minConfidence": 0.7, "responseSource": "database", "maxResponses": 2}'::jsonb,
          ARRAY['admin', 'operator']),
        
        ('trackman_reset', 'Trackman Reset', 'Automatically reset frozen or unresponsive Trackman units via NinjaOne', 'technical', false,
          '{"requires_confirmation": true, "confirmation_message": "If you signed in to your Trackman account before starting, I can reset the system quickly and you can pick back up through the ''My Activities'' button. Let me know and I''ll reset it.", "ninjaone_script": "Restart-TrackMan"}'::jsonb,
          ARRAY['admin', 'operator']),
          
        ('llm_initial_analysis', 'LLM Initial Message Analysis', 'Use AI to understand and respond to all initial customer messages', 'customer_service', false,
          '{"minConfidence": 0.7, "responseSource": "database", "maxResponses": 1, "analyzeAllInitial": true}'::jsonb,
          ARRAY['admin', 'operator'])
      ) AS new_features(feature_key, feature_name, description, category, enabled, config, required_permissions)
      WHERE NOT EXISTS (
        SELECT 1 FROM ai_automation_features WHERE feature_key = new_features.feature_key
      )
    `);
    
    // Create checklist_task_customizations table
    await db.query(`
      CREATE TABLE IF NOT EXISTS checklist_task_customizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category VARCHAR(50) NOT NULL,
        type VARCHAR(50) NOT NULL,
        task_id VARCHAR(100) NOT NULL,
        custom_label TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(category, type, task_id)
      )
    `);
    
    // Add any missing columns
    await db.query('ALTER TABLE ai_automation_features ADD COLUMN IF NOT EXISTS allow_follow_up BOOLEAN DEFAULT true').catch(() => {});
    
    // Create NinjaOne tables if they don't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS ninjaone_scripts (
        id SERIAL PRIMARY KEY,
        script_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        category VARCHAR(50),
        icon VARCHAR(50) DEFAULT 'zap',
        requires_bay BOOLEAN DEFAULT true,
        warning_message TEXT,
        estimated_duration VARCHAR(50) DEFAULT '30-60 seconds',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS ninjaone_devices (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) UNIQUE NOT NULL,
        location VARCHAR(100) NOT NULL,
        bay_number VARCHAR(10),
        device_name VARCHAR(255) NOT NULL,
        device_type VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        last_seen TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create unique constraint if it doesn't exist
    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'ninjaone_devices_location_bay_number_key'
        ) THEN
          ALTER TABLE ninjaone_devices 
          ADD CONSTRAINT ninjaone_devices_location_bay_number_key 
          UNIQUE(location, bay_number);
        END IF;
      END $$;
    `);
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS remote_actions_log (
        id SERIAL PRIMARY KEY,
        action_type VARCHAR(50),
        location VARCHAR(100),
        device_name VARCHAR(100),
        device_id VARCHAR(100),
        initiated_by VARCHAR(255),
        ninja_job_id VARCHAR(100),
        status VARCHAR(50),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);
    
    // Insert default scripts if they don't exist
    await db.query(`
      INSERT INTO ninjaone_scripts (script_id, name, display_name, category, icon, requires_bay, warning_message, estimated_duration)
      VALUES 
        ('restart-trackman', 'restart-trackman', 'Restart TrackMan', 'trackman', 'refresh-cw', true, NULL, '30-60 seconds'),
        ('reboot-pc', 'reboot-pc', 'Reboot PC', 'system', 'power', true, 'This will reboot the entire PC. The bay will be unavailable for 3-5 minutes.', '3-5 minutes'),
        ('restart-music', 'restart-music', 'Restart Music System', 'music', 'music', false, NULL, '30 seconds'),
        ('restart-tv', 'restart-tv', 'Restart TV System', 'tv', 'tv', false, NULL, '30 seconds')
      ON CONFLICT (script_id) DO NOTHING
    `);
    
    // Create indexes
    await db.query(`CREATE INDEX IF NOT EXISTS idx_ninjaone_scripts_active ON ninjaone_scripts(is_active)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_ninjaone_devices_location ON ninjaone_devices(location)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_ninjaone_devices_active ON ninjaone_devices(is_active)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_remote_actions_log_created ON remote_actions_log(created_at DESC)`);
    
    logger.info('✅ Critical tables verified/created');
  } catch (error) {
    logger.error('Failed to ensure critical tables:', error);
    throw error;
  }
}