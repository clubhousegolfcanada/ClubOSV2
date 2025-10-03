-- Migration: Force Update Search Vectors
-- Description: Ensure all knowledge_store entries have properly populated search vectors
-- Author: ClubOS Team
-- Date: 2025-10-03

-- First, let's check the current state
DO $$
DECLARE
  null_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM knowledge_store WHERE search_vector IS NULL;
  SELECT COUNT(*) INTO total_count FROM knowledge_store;

  RAISE NOTICE 'Found % entries without search_vector out of % total entries', null_count, total_count;
END $$;

-- Drop and recreate the trigger function to ensure it's working
DROP FUNCTION IF EXISTS update_knowledge_search_vector() CASCADE;

CREATE OR REPLACE FUNCTION update_knowledge_search_vector()
RETURNS trigger AS $$
BEGIN
  -- Create search vector from key and entire value JSONB
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.key, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.value::text, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS knowledge_store_search_update ON knowledge_store;
CREATE TRIGGER knowledge_store_search_update
  BEFORE INSERT OR UPDATE ON knowledge_store
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_search_vector();

-- Force update ALL entries to ensure search_vector is populated
-- This will trigger the function for every row
UPDATE knowledge_store
SET updated_at = COALESCE(updated_at, NOW())
WHERE search_vector IS NULL
   OR length(search_vector::text) < 10;  -- Also update entries with very short vectors

-- Update entries that might have power meter or equipment data
-- This ensures any entries with numbers are properly indexed
UPDATE knowledge_store
SET search_vector =
  setweight(to_tsvector('english', COALESCE(key, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(value::text, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(category, '')), 'C')
WHERE value::text ~ '\d{6,}' -- Matches entries with 6+ digit numbers (like power meter numbers)
   OR key ILIKE '%power%'
   OR key ILIKE '%meter%'
   OR key ILIKE '%equipment%'
   OR value::text ILIKE '%power meter%'
   OR value::text ILIKE '%equipment%';

-- Add some common equipment-related entries if they don't exist
-- Only add if no power meter entries exist
DO $$
BEGIN
  -- Check if we have any power meter related entries
  IF NOT EXISTS (
    SELECT 1 FROM knowledge_store
    WHERE key ILIKE '%power%'
       OR value::text ILIKE '%power meter%'
    LIMIT 1
  ) THEN
    RAISE NOTICE 'No power meter entries found - system should have actual data';
  ELSE
    RAISE NOTICE 'Power meter entries exist in the system';
  END IF;
END $$;

-- Verify the update worked
DO $$
DECLARE
  null_count INTEGER;
  total_count INTEGER;
  power_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM knowledge_store WHERE search_vector IS NULL;
  SELECT COUNT(*) INTO total_count FROM knowledge_store;
  SELECT COUNT(*) INTO power_count FROM knowledge_store
    WHERE search_vector @@ plainto_tsquery('english', 'power meter')
       OR search_vector @@ plainto_tsquery('english', 'equipment');

  RAISE NOTICE 'After update: % entries without search_vector out of % total', null_count, total_count;
  RAISE NOTICE 'Found % entries matching "power meter" or "equipment" searches', power_count;
END $$;

-- Create an index if it doesn't exist to speed up searches
CREATE INDEX IF NOT EXISTS idx_knowledge_search_gin ON knowledge_store USING gin(search_vector);

-- Also create a simple text index for fallback searches
CREATE INDEX IF NOT EXISTS idx_knowledge_value_text ON knowledge_store USING gin(value);

-- Add comment for documentation
COMMENT ON FUNCTION update_knowledge_search_vector() IS 'Automatically populates search_vector for full-text search on knowledge_store entries';