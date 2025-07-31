-- Add updated_at column to openphone_conversations if it doesn't exist
ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Update existing rows to have updated_at = created_at if created_at exists
UPDATE openphone_conversations
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at IS NULL;