-- Force create missing tables that should have been created in earlier migrations
-- This ensures the tables exist even if previous migrations failed

-- 1. Create ai_automation_response_tracking table (from migration 048)
CREATE TABLE IF NOT EXISTS ai_automation_response_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(255) NOT NULL,
  feature_key VARCHAR(100) NOT NULL,
  response_count INTEGER DEFAULT 1,
  last_response_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(conversation_id, feature_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_response_tracking_conversation ON ai_automation_response_tracking(conversation_id);
CREATE INDEX IF NOT EXISTS idx_response_tracking_feature ON ai_automation_response_tracking(feature_key);

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_response_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger 
-- Note: Using DROP/CREATE pattern to avoid complex existence checks
DROP TRIGGER IF EXISTS update_response_tracking_timestamp ON ai_automation_response_tracking;
CREATE TRIGGER update_response_tracking_timestamp
  BEFORE UPDATE ON ai_automation_response_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_response_tracking_updated_at();

-- 2. Add missing columns to openphone_conversations (from migration 049)
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS assistant_type VARCHAR(50);

ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS last_assistant_type VARCHAR(50);

-- Add index
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_assistant_type 
ON openphone_conversations(assistant_type);

-- Add comments
COMMENT ON COLUMN openphone_conversations.assistant_type IS 'The primary assistant type for this conversation (Emergency, Booking & Access, TechSupport, BrandTone)';
COMMENT ON COLUMN openphone_conversations.last_assistant_type IS 'The assistant type that handled the most recent message';