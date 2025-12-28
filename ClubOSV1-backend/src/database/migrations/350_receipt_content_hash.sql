-- Migration: Add content hash for duplicate receipt detection
-- This prevents the same receipt from being uploaded twice

-- Add content_hash column to receipts table
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

-- Create unique index on content_hash (allows NULL for legacy receipts)
-- This prevents duplicate receipts at the database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_content_hash_unique
ON receipts(content_hash) WHERE content_hash IS NOT NULL;

-- Add index for faster hash lookups
CREATE INDEX IF NOT EXISTS idx_receipts_content_hash
ON receipts(content_hash) WHERE content_hash IS NOT NULL;

-- Comment explaining the column
COMMENT ON COLUMN receipts.content_hash IS 'SHA-256 hash of file_data for duplicate detection';
