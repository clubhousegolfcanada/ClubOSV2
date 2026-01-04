-- Migration: Fix knowledge_store search_vector
-- Description: Add trigger to automatically populate search_vector and update existing entries
-- Created: 2025-10-02

-- Create function to update search_vector
CREATE OR REPLACE FUNCTION update_knowledge_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.key, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.value::text, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search_vector on insert/update
DROP TRIGGER IF EXISTS knowledge_store_search_update ON knowledge_store;
CREATE TRIGGER knowledge_store_search_update
  BEFORE INSERT OR UPDATE ON knowledge_store
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_search_vector();

-- Update all existing entries to populate search_vector
UPDATE knowledge_store
SET search_vector =
  setweight(to_tsvector('english', COALESCE(key, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(value::text, '')), 'B')
WHERE search_vector IS NULL;

-- Log the update
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM knowledge_store
  WHERE search_vector IS NOT NULL;

  RAISE NOTICE 'Updated search_vector for % knowledge_store entries', updated_count;
END $$;