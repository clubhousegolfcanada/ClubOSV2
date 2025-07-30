-- OpenPhone Messages Enhancement Migration
-- Adds support for two-way messaging, unread counts, and message status tracking

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_phone_number 
ON openphone_conversations(phone_number);

CREATE INDEX IF NOT EXISTS idx_openphone_conversations_updated_at 
ON openphone_conversations(updated_at);

-- Create table for message status tracking
CREATE TABLE IF NOT EXISTS message_status (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'sending', 'sent', 'delivered', 'failed'
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add unread count to conversations
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;

-- Add last read timestamp
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE;

-- Create index for message status lookups
CREATE INDEX IF NOT EXISTS idx_message_status_message_id 
ON message_status(message_id);

-- Create trigger to update message_status updated_at
CREATE OR REPLACE FUNCTION update_message_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_message_status_updated_at
BEFORE UPDATE ON message_status
FOR EACH ROW
EXECUTE FUNCTION update_message_status_updated_at();