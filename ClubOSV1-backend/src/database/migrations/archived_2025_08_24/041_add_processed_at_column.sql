-- Add processed_at timestamp to track when conversations were processed
ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;

-- Create index for better performance when querying unprocessed conversations
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_processed ON openphone_conversations(processed) WHERE processed = false;

-- Create index for processed_at to support ordering by processing time
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_processed_at ON openphone_conversations(processed_at) WHERE processed_at IS NOT NULL;