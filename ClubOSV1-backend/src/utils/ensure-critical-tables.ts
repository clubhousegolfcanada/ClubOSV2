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
    
    // Create assistant_knowledge table
    await db.query(`
      CREATE TABLE IF NOT EXISTS assistant_knowledge (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        assistant_type VARCHAR(100) NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        source VARCHAR(50) DEFAULT 'manual',
        confidence DECIMAL(3,2) DEFAULT 0.95,
        usage_count INTEGER DEFAULT 0,
        last_used_at TIMESTAMP,
        created_by VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        automation_key VARCHAR(100),
        metadata JSONB DEFAULT '{}',
        UNIQUE(assistant_type, question)
      )
    `);
    
    // Create indexes for assistant_knowledge
    await db.query('CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_type ON assistant_knowledge(assistant_type)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_active ON assistant_knowledge(is_active)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_automation ON assistant_knowledge(automation_key)');
    
    // Insert gift card knowledge
    await db.query(`
      INSERT INTO assistant_knowledge (assistant_type, question, answer, source, confidence, created_by, automation_key) VALUES
      ('booking & access', 'How can I purchase a gift card?', 'You can purchase gift cards online at www.clubhouse247golf.com/giftcard/purchase. Gift cards are available in various denominations and can be used for bay time, food, and beverages at any Clubhouse 24/7 Golf location.', 'system', 0.99, 'system', 'gift_cards'),
      ('booking & access', 'Do you sell gift cards?', 'Yes! We offer gift cards that make perfect gifts for golf enthusiasts. You can purchase them online at www.clubhouse247golf.com/giftcard/purchase. They''re available in various amounts and can be used for bay time, food, and beverages.', 'system', 0.99, 'system', 'gift_cards')
      ON CONFLICT (assistant_type, question) DO UPDATE 
      SET answer = EXCLUDED.answer,
          updated_at = NOW()
    `);
    
    // Add any missing columns
    await db.query('ALTER TABLE ai_automation_features ADD COLUMN IF NOT EXISTS allow_follow_up BOOLEAN DEFAULT true').catch(() => {});
    
    logger.info('✅ Critical tables verified/created');
  } catch (error) {
    logger.error('Failed to ensure critical tables:', error);
    throw error;
  }
}