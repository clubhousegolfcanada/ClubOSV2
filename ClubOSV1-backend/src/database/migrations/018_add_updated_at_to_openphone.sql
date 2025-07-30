-- Add updated_at column to openphone_conversations if it doesn't exist
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create or replace trigger to update updated_at on row update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_openphone_conversations_updated_at ON openphone_conversations;

CREATE TRIGGER update_openphone_conversations_updated_at
BEFORE UPDATE ON openphone_conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Update existing rows to set updated_at from created_at if null
UPDATE openphone_conversations 
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;