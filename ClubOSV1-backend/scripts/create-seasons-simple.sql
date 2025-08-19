-- Create Seasons for ClubOS
-- This script creates the lifetime season and Year 1 (2025-26) season

-- Create or replace the get_current_season function
CREATE OR REPLACE FUNCTION get_current_season() 
RETURNS UUID AS $$
DECLARE
  season_id UUID;
BEGIN
  -- First try to get an active season (most recent)
  SELECT id INTO season_id 
  FROM seasons 
  WHERE status = 'active' 
  ORDER BY start_date DESC 
  LIMIT 1;
  
  -- If no active season, get the lifetime season
  IF season_id IS NULL THEN
    SELECT id INTO season_id 
    FROM seasons 
    WHERE duration_type = 'lifetime'
    LIMIT 1;
  END IF;
  
  RETURN season_id;
END;
$$ LANGUAGE plpgsql;

-- Delete existing seasons for clean slate (optional - comment out if you want to keep existing)
-- DELETE FROM seasons;

-- Create Lifetime Season (never expires)
INSERT INTO seasons (
  name,
  start_date,
  end_date,
  duration_type,
  status
) VALUES (
  'Lifetime',
  '2025-01-01 00:00:00+00',
  '2099-12-31 23:59:59+00',
  'lifetime',
  'active'
) ON CONFLICT DO NOTHING;

-- Create Year 1 Season (2025-26)
INSERT INTO seasons (
  name,
  start_date,
  end_date,
  duration_type,
  status
) VALUES (
  'Year 1 (2025-26)',
  '2025-01-01 00:00:00+00',
  '2026-12-31 23:59:59+00',
  'annual',
  'active'
) ON CONFLICT DO NOTHING;

-- Create Winter 2025 (Q1)
INSERT INTO seasons (
  name,
  start_date,
  end_date,
  duration_type,
  status
) VALUES (
  'Winter 2025',
  '2025-01-01 00:00:00+00',
  '2025-03-31 23:59:59+00',
  'quarterly',
  'active'
) ON CONFLICT DO NOTHING;

-- Verify seasons were created
SELECT 
  id,
  name,
  duration_type,
  status,
  start_date::date as start_date,
  end_date::date as end_date
FROM seasons
ORDER BY start_date;