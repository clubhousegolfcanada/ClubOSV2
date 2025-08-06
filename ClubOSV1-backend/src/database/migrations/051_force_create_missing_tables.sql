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

-- Create indexes only if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'ai_automation_response_tracking') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_response_tracking_conversation') THEN
      CREATE INDEX idx_response_tracking_conversation ON ai_automation_response_tracking(conversation_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_response_tracking_feature') THEN
      CREATE INDEX idx_response_tracking_feature ON ai_automation_response_tracking(feature_key);
    END IF;
  END IF;
END $$;

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_response_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger only if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'ai_automation_response_tracking') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'update_response_tracking_timestamp' 
      AND tgrelid = 'ai_automation_response_tracking'::regclass
    ) THEN
      CREATE TRIGGER update_response_tracking_timestamp
        BEFORE UPDATE ON ai_automation_response_tracking
        FOR EACH ROW
        EXECUTE FUNCTION update_response_tracking_updated_at();
    END IF;
  END IF;
END $$;

-- 2. Add missing columns to openphone_conversations (from migration 049)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'openphone_conversations') THEN
    -- Add assistant_type column if it doesn't exist
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'openphone_conversations' 
      AND column_name = 'assistant_type'
    ) THEN
      ALTER TABLE openphone_conversations ADD COLUMN assistant_type VARCHAR(50);
    END IF;
    
    -- Add last_assistant_type column if it doesn't exist
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'openphone_conversations' 
      AND column_name = 'last_assistant_type'
    ) THEN
      ALTER TABLE openphone_conversations ADD COLUMN last_assistant_type VARCHAR(50);
    END IF;
    
    -- Add index if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_openphone_conversations_assistant_type') THEN
      CREATE INDEX idx_openphone_conversations_assistant_type ON openphone_conversations(assistant_type);
    END IF;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN openphone_conversations.assistant_type IS 'The primary assistant type for this conversation (Emergency, Booking & Access, TechSupport, BrandTone)';
COMMENT ON COLUMN openphone_conversations.last_assistant_type IS 'The assistant type that handled the most recent message';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 051: Force created missing tables and columns successfully';
END $$;