-- Ensure all necessary columns exist in openphone_conversations table
-- This migration adds any missing columns without dropping existing data

-- First ensure the table exists
CREATE TABLE IF NOT EXISTS openphone_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- Add columns if they don't exist
ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS conversation_id VARCHAR(255) UNIQUE;

ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);

ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS employee_name VARCHAR(255);

ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS messages JSONB NOT NULL DEFAULT '[]';

ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;

ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_phone_number 
  ON openphone_conversations(phone_number);

CREATE INDEX IF NOT EXISTS idx_openphone_conversations_processed 
  ON openphone_conversations(processed);

CREATE INDEX IF NOT EXISTS idx_openphone_conversations_created_at 
  ON openphone_conversations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_openphone_conversations_updated_at 
  ON openphone_conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_openphone_conversations_unread 
  ON openphone_conversations(unread_count) 
  WHERE unread_count > 0;