-- Enable auto-send for gift cards automation (safe, read-only information)
-- This allows AI to automatically send gift card purchase links to customers

-- First ensure the table exists with new columns
ALTER TABLE ai_automation_features
ADD COLUMN IF NOT EXISTS can_send_responses BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_execute_actions BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS use_knowledge_store BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS require_confirmation BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS confidence_threshold DECIMAL(3,2) DEFAULT 0.80,
ADD COLUMN IF NOT EXISTS max_auto_responses INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS action_config JSONB DEFAULT '{}';

-- Ensure ai_automation_actions table exists
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

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_ai_actions_conversation ON ai_automation_actions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_phone ON ai_automation_actions(phone_number);
CREATE INDEX IF NOT EXISTS idx_ai_actions_type ON ai_automation_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_actions_status ON ai_automation_actions(status);
CREATE INDEX IF NOT EXISTS idx_ai_actions_created ON ai_automation_actions(created_at DESC);

-- Enable auto-send for gift cards only (safe starting point)
UPDATE ai_automation_features 
SET 
  can_send_responses = true,
  can_execute_actions = false,
  use_knowledge_store = true,
  confidence_threshold = 0.50,  -- Already lowered in previous migration
  max_auto_responses = 3,
  action_config = jsonb_build_object(
    'maxResponsesPerHour', 10,
    'allowedHours', '{"start": "09:00", "end": "23:00"}',
    'testMode', false,
    'logAllResponses', true
  )
WHERE feature_key = 'gift_cards';

-- Ensure gift cards automation is enabled
UPDATE ai_automation_features 
SET enabled = true 
WHERE feature_key = 'gift_cards';

-- Add monitoring for auto-sent messages
CREATE TABLE IF NOT EXISTS ai_automation_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key VARCHAR(100),
  metric_type VARCHAR(50), -- 'messages_sent', 'actions_executed', 'errors', 'confidence_avg'
  metric_value DECIMAL(10,2),
  metric_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for monitoring queries
CREATE INDEX IF NOT EXISTS idx_ai_monitoring_date ON ai_automation_monitoring(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_monitoring_feature ON ai_automation_monitoring(feature_key);

-- Log this configuration change
INSERT INTO ai_automation_monitoring (feature_key, metric_type, metric_value)
VALUES ('gift_cards', 'config_change', 1);