-- Enhanced AI Automation Actions & Knowledge Store Integration
-- This migration adds the ability for AI to execute actions and send responses automatically

-- Add action execution configuration to features
ALTER TABLE ai_automation_features
ADD COLUMN IF NOT EXISTS can_execute_actions BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_send_responses BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS use_knowledge_store BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS require_confirmation BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS confidence_threshold DECIMAL(3,2) DEFAULT 0.80,
ADD COLUMN IF NOT EXISTS max_auto_responses INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS action_config JSONB DEFAULT '{}';

-- Track actual actions taken by AI
CREATE TABLE IF NOT EXISTS ai_automation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID REFERENCES ai_automation_features(id),
  conversation_id VARCHAR(255),
  phone_number VARCHAR(50),
  action_type VARCHAR(50), -- 'send_message', 'reset_trackman', 'unlock_door', 'create_ticket'
  action_details JSONB,
  confidence_score DECIMAL(3,2),
  knowledge_source VARCHAR(50), -- 'knowledge_store', 'patterns', 'llm', 'assistant'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled', 'confirmed'
  executed_at TIMESTAMP,
  executed_by VARCHAR(50), -- 'ai_auto', 'user_confirmed', 'staff_override'
  response_text TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_actions_conversation ON ai_automation_actions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_phone ON ai_automation_actions(phone_number);
CREATE INDEX IF NOT EXISTS idx_ai_actions_type ON ai_automation_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_actions_status ON ai_automation_actions(status);
CREATE INDEX IF NOT EXISTS idx_ai_actions_created ON ai_automation_actions(created_at DESC);

-- Add new automation features for auto-response and auto-execution
INSERT INTO ai_automation_features (
  feature_key, 
  feature_name, 
  description, 
  category,
  enabled,
  can_send_responses,
  can_execute_actions,
  use_knowledge_store,
  confidence_threshold,
  config,
  required_permissions
) VALUES 
(
  'auto_respond',
  'Automatic Response',
  'AI sends responses directly to customers without human review when confidence is high',
  'customer_service',
  false, -- Start disabled for safety
  true,
  false,
  true,
  0.85,
  '{
    "maxAutoResponses": 3,
    "allowedTopics": ["gift_cards", "hours", "booking_info"],
    "requireHighConfidence": true,
    "useKnowledgeStoreFirst": true
  }'::jsonb,
  ARRAY['admin', 'operator']
),
(
  'auto_execute',
  'Automatic Action Execution',
  'AI executes actions like simulator resets and door unlocks automatically',
  'technical',
  false, -- Start disabled for safety
  true,
  true,
  true,
  0.90,
  '{
    "allowedActions": ["trackman_reset", "projector_control", "door_unlock"],
    "requiresHighConfidence": true,
    "maxActionsPerHour": 10,
    "confirmationRequired": ["door_unlock"]
  }'::jsonb,
  ARRAY['admin']
),
(
  'knowledge_first',
  'Knowledge Store Priority',
  'Check local knowledge store before using OpenAI API to save costs and improve speed',
  'system',
  true, -- Enable by default
  false,
  false,
  true,
  0.70,
  '{
    "fallbackToLLM": true,
    "cacheResponses": true,
    "updatePatternsAutomatically": true
  }'::jsonb,
  ARRAY['admin', 'operator', 'support']
)
ON CONFLICT (feature_key) DO UPDATE SET
  description = EXCLUDED.description,
  config = EXCLUDED.config,
  updated_at = NOW();

-- Update existing features to have the new columns with safe defaults
UPDATE ai_automation_features 
SET 
  can_send_responses = false,
  can_execute_actions = false,
  use_knowledge_store = true,
  confidence_threshold = 0.80
WHERE feature_key IN ('gift_cards', 'trackman_reset', 'booking_change');

-- Enable knowledge store usage for gift cards since it's well-tested
UPDATE ai_automation_features
SET 
  use_knowledge_store = true,
  can_send_responses = false, -- Still require human review initially
  confidence_threshold = 0.70
WHERE feature_key = 'gift_cards';

-- Add trigger to update timestamp
CREATE OR REPLACE FUNCTION update_ai_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ai_actions_updated_at ON ai_automation_actions;
CREATE TRIGGER update_ai_actions_updated_at
  BEFORE UPDATE ON ai_automation_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_actions_updated_at();

-- Log the migration
INSERT INTO ai_automation_usage (
  feature_id,
  trigger_type,
  input_data,
  output_data,
  success,
  execution_time_ms,
  created_at
) VALUES (
  (SELECT id FROM ai_automation_features WHERE feature_key = 'knowledge_first'),
  'system',
  '{"action": "migration_055_applied"}'::jsonb,
  '{"features_added": ["auto_respond", "auto_execute", "knowledge_first"]}'::jsonb,
  true,
  0,
  NOW()
);