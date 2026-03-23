-- Migration: Add content hash for duplicate receipt detection
-- Re-applying migration 350 which was archived but never run on production
-- This prevents the same receipt from being uploaded twice

-- Add content_hash column to receipts table
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

-- Drop partial unique index if it exists (partial index doesn't work with ON CONFLICT)
DROP INDEX IF EXISTS idx_receipts_content_hash_unique;

-- Create non-partial unique index (PostgreSQL allows multiple NULLs in unique indexes)
-- This enables ON CONFLICT (content_hash) DO NOTHING for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_content_hash_unique
ON receipts(content_hash);

-- Add index for faster hash lookups
CREATE INDEX IF NOT EXISTS idx_receipts_content_hash
ON receipts(content_hash) WHERE content_hash IS NOT NULL;

-- Comment explaining the column
COMMENT ON COLUMN receipts.content_hash IS 'SHA-256 hash of file_data for duplicate detection';
