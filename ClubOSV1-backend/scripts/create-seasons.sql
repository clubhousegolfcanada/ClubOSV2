-- Create Seasons for ClubOS
-- This script creates the lifetime season and Year 1 (2025-26) season

-- First, ensure we have the get_current_season function
CREATE OR REPLACE FUNCTION get_current_season() 
RETURNS UUID AS $$
DECLARE
  season_id UUID;
BEGIN
  -- First try to get an active season
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

-- Create Lifetime Season (never expires)
INSERT INTO seasons (
  name,
  start_date,
  end_date,
  duration_type,
  status,
  created_at,
  updated_at
) VALUES (
  'Lifetime',
  '2025-01-01 00:00:00+00',
  '2099-12-31 23:59:59+00', -- Far future date
  'lifetime',
  'active',
  NOW(),
  NOW()
) ON CONFLICT (name) DO UPDATE SET
  status = 'active',
  updated_at = NOW();

-- Create Year 1 Season (2025-26)
INSERT INTO seasons (
  name,
  start_date,
  end_date,
  duration_type,
  status,
  created_at,
  updated_at
) VALUES (
  'Year 1 (2025-26)',
  '2025-01-01 00:00:00+00',
  '2026-12-31 23:59:59+00',
  'annual',
  'active',
  NOW(),
  NOW()
) ON CONFLICT (name) DO UPDATE SET
  status = 'active',
  updated_at = NOW();

-- Also create Winter 2025 as a quarterly season
INSERT INTO seasons (
  name,
  start_date,
  end_date,
  duration_type,
  status,
  created_at,
  updated_at
) VALUES (
  'Winter 2025',
  '2025-01-01 00:00:00+00',
  '2025-03-31 23:59:59+00',
  'quarterly',
  'active',
  NOW(),
  NOW()
) ON CONFLICT (name) DO UPDATE SET
  status = 'active',
  updated_at = NOW();

-- Verify seasons were created
SELECT 
  name,
  duration_type,
  status,
  start_date,
  end_date
FROM seasons
ORDER BY start_date;