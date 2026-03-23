-- Migration: Add fuzzy_duplicate_of column for duplicate flagging
-- Stores UUID of the potential duplicate receipt for review

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS fuzzy_duplicate_of UUID;

-- Index for fast lookup of flagged receipts
CREATE INDEX IF NOT EXISTS idx_receipts_fuzzy_duplicate
ON receipts(fuzzy_duplicate_of) WHERE fuzzy_duplicate_of IS NOT NULL;
