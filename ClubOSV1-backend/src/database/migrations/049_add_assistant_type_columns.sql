-- Add missing assistant_type columns to openphone_conversations table
-- These columns track which assistant type is handling each conversation

ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS assistant_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_assistant_type VARCHAR(50);

-- Add index for performance when filtering by assistant type
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_assistant_type 
ON openphone_conversations(assistant_type);

-- Add comment explaining the columns
COMMENT ON COLUMN openphone_conversations.assistant_type IS 'The primary assistant type for this conversation (Emergency, Booking & Access, TechSupport, BrandTone)';
COMMENT ON COLUMN openphone_conversations.last_assistant_type IS 'The assistant type that handled the most recent message';