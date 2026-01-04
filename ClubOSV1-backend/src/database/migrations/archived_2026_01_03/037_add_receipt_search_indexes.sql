-- Migration: Add search indexes for receipt queries
-- Created: 2025-01-18
-- Description: Adds indexes to improve receipt search and natural language query performance

-- Add indexes for common search fields
CREATE INDEX IF NOT EXISTS idx_receipts_vendor
ON receipts(vendor);

CREATE INDEX IF NOT EXISTS idx_receipts_purchase_date
ON receipts(purchase_date);

CREATE INDEX IF NOT EXISTS idx_receipts_club_location
ON receipts(club_location);

CREATE INDEX IF NOT EXISTS idx_receipts_reconciled
ON receipts(reconciled);

CREATE INDEX IF NOT EXISTS idx_receipts_category
ON receipts(category);

CREATE INDEX IF NOT EXISTS idx_receipts_created_at
ON receipts(created_at DESC);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_receipts_date_vendor
ON receipts(purchase_date DESC, vendor);

CREATE INDEX IF NOT EXISTS idx_receipts_location_date
ON receipts(club_location, created_at DESC);

-- Text search index for vendor and notes
CREATE INDEX IF NOT EXISTS idx_receipts_vendor_text
ON receipts USING gin(to_tsvector('english', COALESCE(vendor, '')));

CREATE INDEX IF NOT EXISTS idx_receipts_notes_text
ON receipts USING gin(to_tsvector('english', COALESCE(notes, '')));

CREATE INDEX IF NOT EXISTS idx_receipts_ocr_text
ON receipts USING gin(to_tsvector('english', COALESCE(ocr_text, '')));

-- Index for amount range queries
CREATE INDEX IF NOT EXISTS idx_receipts_amount_cents
ON receipts(amount_cents);

-- Partial index for unreconciled receipts (commonly queried)
CREATE INDEX IF NOT EXISTS idx_receipts_unreconciled
ON receipts(created_at DESC)
WHERE reconciled = false;

-- Index for user-based queries
CREATE INDEX IF NOT EXISTS idx_receipts_uploader_user_id
ON receipts(uploader_user_id);

-- Add search_vector column for full-text search if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receipts'
    AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE receipts ADD COLUMN search_vector tsvector;
  END IF;
END $$;

-- Create trigger to update search vector
CREATE OR REPLACE FUNCTION update_receipt_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.vendor, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.notes, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.ocr_text, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_receipt_search_vector'
  ) THEN
    CREATE TRIGGER update_receipt_search_vector
    BEFORE INSERT OR UPDATE ON receipts
    FOR EACH ROW EXECUTE FUNCTION update_receipt_search_vector();
  END IF;
END $$;

-- Update existing rows to populate search_vector
UPDATE receipts
SET search_vector =
  setweight(to_tsvector('english', COALESCE(vendor, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(notes, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(ocr_text, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(category, '')), 'D')
WHERE search_vector IS NULL;

-- Create index on search_vector
CREATE INDEX IF NOT EXISTS idx_receipts_search_vector
ON receipts USING gin(search_vector);

-- Add receipt_audit_log table if it doesn't exist (referenced in the API)
CREATE TABLE IF NOT EXISTS receipt_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  changed_fields JSONB,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_receipt_audit_log_receipt_id (receipt_id),
  INDEX idx_receipt_audit_log_user_id (user_id),
  INDEX idx_receipt_audit_log_created_at (created_at DESC)
);

-- Add comment explaining the indexes
COMMENT ON INDEX idx_receipts_vendor IS 'Speed up vendor-based searches';
COMMENT ON INDEX idx_receipts_purchase_date IS 'Speed up date range queries';
COMMENT ON INDEX idx_receipts_unreconciled IS 'Optimize queries for unreconciled receipts';
COMMENT ON INDEX idx_receipts_search_vector IS 'Full-text search across receipt content';