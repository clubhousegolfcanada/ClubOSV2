-- Migration: Add is_active column to seasons table
-- Purpose: Fix seasonal reset and rank calculation jobs that expect is_active column

-- Add is_active column if it doesn't exist
ALTER TABLE seasons 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Update existing seasons - mark the most recent one as active
UPDATE seasons 
SET is_active = false;

UPDATE seasons 
SET is_active = true 
WHERE id = (
  SELECT id FROM seasons 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_seasons_is_active 
ON seasons(is_active) 
WHERE is_active = true;

-- Add constraint to ensure only one active season
CREATE OR REPLACE FUNCTION ensure_single_active_season()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE seasons SET is_active = false WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_single_active_season ON seasons;
CREATE TRIGGER trg_single_active_season
AFTER INSERT OR UPDATE OF is_active ON seasons
FOR EACH ROW
WHEN (NEW.is_active = true)
EXECUTE FUNCTION ensure_single_active_season();