-- Migration: Fix OpenPhone Indexes
-- Purpose: Add missing is_read column and create proper indexes

-- UP
-- Add is_read column if it doesn't exist
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Create indexes safely
CREATE INDEX IF NOT EXISTS idx_openphone_phone_number 
  ON openphone_conversations(phone_number);

CREATE INDEX IF NOT EXISTS idx_openphone_updated_at 
  ON openphone_conversations(updated_at);

CREATE INDEX IF NOT EXISTS idx_openphone_is_read 
  ON openphone_conversations(is_read);

CREATE INDEX IF NOT EXISTS idx_openphone_created_at 
  ON openphone_conversations(created_at);

-- DOWN
DROP INDEX IF EXISTS idx_openphone_is_read;
DROP INDEX IF EXISTS idx_openphone_created_at;
ALTER TABLE openphone_conversations DROP COLUMN IF EXISTS is_read;