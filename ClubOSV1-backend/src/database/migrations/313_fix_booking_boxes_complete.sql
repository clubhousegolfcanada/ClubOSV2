-- Migration: 313_fix_booking_boxes_complete.sql
-- Date: 2025-10-06
-- Purpose: Complete fix for booking locations and boxes, handling all tables

BEGIN;

-- ============================================
-- STEP 1: Handle the 'spaces' table that references halifax
-- ============================================

-- Move any spaces from halifax to bayers-lake
UPDATE spaces
SET location_id = 'bayers-lake'
WHERE location_id = 'halifax';

-- ============================================
-- STEP 2: Delete duplicate Halifax location
-- ============================================

-- Now we can safely delete halifax location
DELETE FROM booking_locations
WHERE id = 'halifax';

-- ============================================
-- STEP 3: Update Bayers Lake to Halifax (Bayers Lake)
-- ============================================

UPDATE booking_locations
SET name = 'Halifax (Bayers Lake)',
    city = 'Halifax'
WHERE id = 'bayers-lake';

-- ============================================
-- STEP 4: Rename all Bays to Boxes in booking_spaces
-- ============================================

UPDATE booking_spaces
SET name = REPLACE(name, 'Bay ', 'Box ')
WHERE name LIKE 'Bay %';

-- ============================================
-- STEP 5: Fix box counts for each location
-- ============================================

-- TRURO: Add Box 3 if it doesn't exist
INSERT INTO booking_spaces (
  id,
  location_id,
  name,
  display_order,
  is_active,
  created_at,
  updated_at
)
SELECT
  'truro-box-3',
  'truro',
  'Box 3',
  3,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM booking_spaces
  WHERE location_id = 'truro'
  AND (name = 'Box 3' OR name = 'Bay 3')
);

-- RIVER OAKS: Keep only Box 1
DELETE FROM booking_spaces
WHERE location_id = 'river-oaks'
AND name IN ('Box 2', 'Box 3', 'Box 4', 'Bay 2', 'Bay 3', 'Bay 4');

-- ============================================
-- STEP 6: Update display ordering
-- ============================================

UPDATE booking_spaces
SET display_order =
  CASE
    WHEN name = 'Box 1' THEN 1
    WHEN name = 'Box 2' THEN 2
    WHEN name = 'Box 3' THEN 3
    WHEN name = 'Box 4' THEN 4
    ELSE display_order
  END
WHERE name LIKE 'Box %';

-- ============================================
-- STEP 7: Display verification
-- ============================================

DO $$
DECLARE
  loc RECORD;
  box_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=====================================';
  RAISE NOTICE 'Final Box Configuration:';
  RAISE NOTICE '=====================================';

  FOR loc IN
    SELECT id, name
    FROM booking_locations
    WHERE id NOT IN ('halifax')  -- Exclude deleted location
    ORDER BY name
  LOOP
    SELECT COUNT(*) INTO box_count
    FROM booking_spaces
    WHERE location_id = loc.id;

    RAISE NOTICE '% (%): % boxes', loc.name, loc.id, box_count;
  END LOOP;

  RAISE NOTICE '=====================================';
  RAISE NOTICE '';
END $$;

COMMIT;

-- ============================================
-- VERIFICATION QUERY
-- ============================================

SELECT
  bl.id as location_id,
  bl.name as location_name,
  COUNT(bs.id) as box_count,
  STRING_AGG(bs.name, ', ' ORDER BY bs.display_order) as boxes
FROM booking_locations bl
LEFT JOIN booking_spaces bs ON bl.id = bs.location_id
GROUP BY bl.id, bl.name
ORDER BY bl.name;