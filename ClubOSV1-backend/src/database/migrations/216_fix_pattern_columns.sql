-- Migration: Fix missing pattern and created_at columns
-- Date: 2025-09-07
-- Purpose: Add missing columns that the API code expects

-- Add pattern column (alias for trigger_text)
ALTER TABLE decision_patterns 
ADD COLUMN IF NOT EXISTS pattern TEXT;

-- Populate pattern from trigger_text or first trigger_example
UPDATE decision_patterns 
SET pattern = COALESCE(trigger_text, trigger_examples[1], '')
WHERE pattern IS NULL;

-- Add created_at column
ALTER TABLE decision_patterns 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Backfill created_at from first_seen
UPDATE decision_patterns 
SET created_at = COALESCE(first_seen, NOW())
WHERE created_at IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_patterns_created_at 
ON decision_patterns(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patterns_pattern 
ON decision_patterns(pattern);

-- Add comments
COMMENT ON COLUMN decision_patterns.pattern IS 'Primary trigger text for the pattern (synced with trigger_text)';
COMMENT ON COLUMN decision_patterns.created_at IS 'When the pattern was created (synced with first_seen)';

-- Create trigger to keep pattern and trigger_text in sync
CREATE OR REPLACE FUNCTION sync_pattern_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- When pattern is updated, update trigger_text
  IF NEW.pattern IS DISTINCT FROM OLD.pattern THEN
    NEW.trigger_text = NEW.pattern;
  END IF;
  
  -- When trigger_text is updated, update pattern
  IF NEW.trigger_text IS DISTINCT FROM OLD.trigger_text THEN
    NEW.pattern = NEW.trigger_text;
  END IF;
  
  -- Keep created_at and first_seen in sync
  IF NEW.first_seen IS DISTINCT FROM OLD.first_seen THEN
    NEW.created_at = NEW.first_seen;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updates
DROP TRIGGER IF EXISTS sync_pattern_columns_trigger ON decision_patterns;
CREATE TRIGGER sync_pattern_columns_trigger
BEFORE UPDATE ON decision_patterns
FOR EACH ROW
EXECUTE FUNCTION sync_pattern_columns();

-- Verify the fix
DO $$
DECLARE
  has_pattern BOOLEAN;
  has_created_at BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'decision_patterns' AND column_name = 'pattern'
  ) INTO has_pattern;
  
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'decision_patterns' AND column_name = 'created_at'
  ) INTO has_created_at;
  
  IF has_pattern AND has_created_at THEN
    RAISE NOTICE '✅ Migration successful: pattern and created_at columns added';
  ELSE
    RAISE EXCEPTION '❌ Migration failed: columns not added properly';
  END IF;
END $$;