-- Fix for missing columns that should have been added by previous migrations
-- This ensures all required columns exist even if previous migrations were not run

-- Add unread_count column if it doesn't exist (from migration 017)
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;

-- Add conversation_id column if it doesn't exist (from migration 012)
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS conversation_id VARCHAR(255);

-- Add updated_at column if it doesn't exist (from migration 012)
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add last_read_at column if it doesn't exist (from migration 017)
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE;

-- Ensure all necessary indexes exist
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_conversation_id 
ON openphone_conversations(conversation_id);

CREATE INDEX IF NOT EXISTS idx_openphone_conversations_updated_at 
ON openphone_conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_openphone_conversations_phone_number 
ON openphone_conversations(phone_number);

-- Ensure the updated_at trigger exists
CREATE OR REPLACE FUNCTION update_openphone_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_openphone_updated_at ON openphone_conversations;
CREATE TRIGGER update_openphone_updated_at
    BEFORE UPDATE ON openphone_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_openphone_updated_at_column();