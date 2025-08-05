-- Create the missing ai_automation_response_tracking table
-- This table tracks how many times we've responded to a conversation with each automation type

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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_response_tracking_conversation ON ai_automation_response_tracking(conversation_id);
CREATE INDEX IF NOT EXISTS idx_response_tracking_feature ON ai_automation_response_tracking(feature_key);

-- Add trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_response_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_response_tracking_timestamp
  BEFORE UPDATE ON ai_automation_response_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_response_tracking_updated_at();