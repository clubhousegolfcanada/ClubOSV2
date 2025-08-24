-- Add missing columns to openphone_conversations table
-- These columns are used by the OpenPhone webhook handlers but were missing from the original schema

-- Add conversation_id column for conversation grouping
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS conversation_id VARCHAR(255);

-- Add updated_at column for tracking last message time
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Create index on conversation_id for efficient queries
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_conversation_id 
ON openphone_conversations(conversation_id);

-- Create index on updated_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_updated_at 
ON openphone_conversations(updated_at DESC);

-- Create index on phone_number for conversation grouping
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_phone_number 
ON openphone_conversations(phone_number);

-- Add function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_openphone_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on row updates
DROP TRIGGER IF EXISTS update_openphone_updated_at ON openphone_conversations;
CREATE TRIGGER update_openphone_updated_at
    BEFORE UPDATE ON openphone_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_openphone_updated_at_column();