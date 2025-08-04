#!/bin/bash

echo "Running AI automation features migration..."

# Get the SQL content from the migration file
cat > /tmp/ai_automation_migration.sql << 'EOF'
-- AI Automation Features and Toggles
-- Stores configuration for automated AI responses and actions

-- Main automation features table
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
);

-- Track automation usage for analytics
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
);

-- Automation rules and patterns
CREATE TABLE IF NOT EXISTS ai_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID REFERENCES ai_automation_features(id),
  rule_type VARCHAR(50),
  rule_data JSONB NOT NULL,
  priority INTEGER DEFAULT 100,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_features_enabled ON ai_automation_features(enabled);
CREATE INDEX IF NOT EXISTS idx_ai_features_category ON ai_automation_features(category);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ai_automation_usage(feature_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_automation_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_rules_feature ON ai_automation_rules(feature_id);

-- Insert initial automation features if they don't exist
INSERT INTO ai_automation_features (feature_key, feature_name, description, category, enabled, config, required_permissions) 
SELECT * FROM (VALUES
  ('gift_cards', 'Gift Card Inquiries', 'Automatically respond to gift card purchase questions with link to purchase page', 'customer_service', false, 
    '{"response_template": "You can purchase gift cards at www.clubhouse247golf.com/giftcard/purchase. Gift cards are available in various denominations and can be used for bay time, food, and beverages.", "minConfidence": 0.7}'::jsonb,
    ARRAY['admin', 'operator']),
  
  ('trackman_reset', 'Trackman Reset', 'Automatically reset frozen or unresponsive Trackman units via NinjaOne', 'technical', false,
    '{"requires_confirmation": true, "confirmation_message": "If you signed in to your Trackman account before starting, I can reset the system quickly and you can pick back up through the ''My Activities'' button. Let me know and I''ll reset it.", "ninjaone_script": "Restart-TrackMan"}'::jsonb,
    ARRAY['admin', 'operator'])
) AS new_features(feature_key, feature_name, description, category, enabled, config, required_permissions)
WHERE NOT EXISTS (
  SELECT 1 FROM ai_automation_features WHERE feature_key = new_features.feature_key
);

-- Add missing column if it doesn't exist
ALTER TABLE ai_automation_features ADD COLUMN IF NOT EXISTS allow_follow_up BOOLEAN DEFAULT true;
EOF

# Run the migration
echo "Executing migration on Railway database..."
railway run psql $DATABASE_URL -f /tmp/ai_automation_migration.sql

# Mark migration as executed
echo "Marking migration as executed..."
railway run psql $DATABASE_URL -c "INSERT INTO migrations (filename) VALUES ('027_ai_automation_features.sql') ON CONFLICT (filename) DO NOTHING;"

echo "Migration completed!"