-- Add response limits and source toggle to AI automations
-- This prevents AI from spamming customers and allows choice between database/hardcoded responses

-- Add new columns to automation features config
UPDATE ai_automation_features 
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(
      config,
      '{maxResponses}',
      '2'::jsonb
    ),
    '{responseSource}',
    '"database"'::jsonb
  ),
  '{hardcodedResponse}',
  '""'::jsonb
);

-- Create table to track automation responses per conversation
CREATE TABLE IF NOT EXISTS ai_automation_response_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  feature_key VARCHAR(100) NOT NULL,
  response_count INTEGER DEFAULT 0,
  last_response_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(conversation_id, feature_key)
);

-- Create index for fast lookups
CREATE INDEX idx_automation_response_tracking_conversation 
ON ai_automation_response_tracking(conversation_id, feature_key);

CREATE INDEX idx_automation_response_tracking_phone 
ON ai_automation_response_tracking(phone_number, feature_key);

-- Add default hardcoded responses for existing features
UPDATE ai_automation_features 
SET config = jsonb_set(
  config,
  '{hardcodedResponse}',
  '"You can purchase gift cards at www.clubhouse247golf.com/giftcard/purchase."'::jsonb
)
WHERE feature_key = 'gift_cards';

UPDATE ai_automation_features 
SET config = jsonb_set(
  config,
  '{hardcodedResponse}',
  '"We are open Monday-Thursday 11am-10pm, Friday 11am-11pm, Saturday 10am-11pm, and Sunday 10am-9pm."'::jsonb
)
WHERE feature_key = 'hours_of_operation';

UPDATE ai_automation_features 
SET config = jsonb_set(
  config,
  '{hardcodedResponse}',
  '"We offer monthly memberships with benefits including priority booking and discounts. Visit our website or stop by to learn more!"'::jsonb
)
WHERE feature_key = 'membership_info';

-- Set different max responses for different features
UPDATE ai_automation_features 
SET config = jsonb_set(config, '{maxResponses}', '1'::jsonb)
WHERE feature_key IN ('gift_cards', 'hours_of_operation', 'membership_info');

UPDATE ai_automation_features 
SET config = jsonb_set(config, '{maxResponses}', '2'::jsonb)
WHERE feature_key IN ('trackman_reset', 'simulator_reboot', 'tv_restart');

-- Add trigger for updating timestamp
CREATE OR REPLACE FUNCTION update_automation_response_tracking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_automation_response_tracking_timestamp
  BEFORE UPDATE ON ai_automation_response_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_automation_response_tracking_timestamp();