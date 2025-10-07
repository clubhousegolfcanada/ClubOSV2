-- Migration: 312_fix_booking_boxes_safe.sql
-- Date: 2025-10-06
-- Purpose: Safely fix booking locations and rename Bays to Boxes
-- Target Configuration:
--   Bedford: 2 boxes
--   Dartmouth: 4 boxes
--   Halifax (Bayers Lake): 4 boxes
--   Truro: 3 boxes
--   River Oaks: 1 box
--   Stratford: 3 boxes

-- Start transaction
BEGIN;

-- ============================================
-- STEP 1: Handle duplicate Halifax location
-- ============================================

-- Check if bookings table exists and has location_id column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'location_id'
  ) THEN
    -- Move any bookings from 'halifax' to 'bayers-lake'
    UPDATE bookings
    SET location_id = 'bayers-lake'
    WHERE location_id = 'halifax';

    RAISE NOTICE 'Moved bookings from halifax to bayers-lake';
  END IF;
END $$;

-- Delete spaces for duplicate halifax location if they exist
DELETE FROM booking_spaces
WHERE location_id = 'halifax';

-- Delete duplicate halifax location if it exists
DELETE FROM booking_locations
WHERE id = 'halifax';

-- ============================================
-- STEP 2: Update Bayers Lake to Halifax
-- ============================================

-- Update the Bayers Lake location name
UPDATE booking_locations
SET name = 'Halifax (Bayers Lake)',
    city = 'Halifax'
WHERE id = 'bayers-lake';

-- ============================================
-- STEP 3: Rename all Bays to Boxes
-- ============================================

-- Handle both "Bay" and "Simulator" naming patterns
UPDATE booking_spaces
SET name =
  CASE
    WHEN name LIKE 'Bay %' THEN REPLACE(name, 'Bay ', 'Box ')
    WHEN name LIKE 'Simulator %' THEN REPLACE(name, 'Simulator ', 'Box ')
    ELSE name
  END
WHERE name LIKE 'Bay %' OR name LIKE 'Simulator %';

-- ============================================
-- STEP 4: Fix box counts for each location
-- ============================================

-- TRURO: Should have 3 boxes
-- Check current count and add if needed
DO $$
DECLARE
  truro_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO truro_count
  FROM booking_spaces
  WHERE location_id = 'truro';

  -- Add Box 3 if we only have 2
  IF truro_count = 2 THEN
    INSERT INTO booking_spaces (
      id,
      location_id,
      name,
      display_order,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      'truro-box-3',
      'truro',
      'Box 3',
      3,
      true,
      NOW(),
      NOW()
    );
    RAISE NOTICE 'Added Box 3 to Truro';
  END IF;
END $$;

-- RIVER OAKS: Should have only 1 box
-- Remove extra boxes
DELETE FROM booking_spaces
WHERE location_id = 'river-oaks'
AND (name IN ('Box 2', 'Box 3', 'Box 4')
     OR display_order > 1);

-- ============================================
-- STEP 5: Ensure proper display ordering
-- ============================================

-- Update display order based on box number
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
-- STEP 6: Generate consistent IDs
-- ============================================

-- Update IDs to follow pattern: location-box-number
UPDATE booking_spaces
SET id = CONCAT(location_id, '-box-', SUBSTRING(name FROM '[0-9]+'))
WHERE name LIKE 'Box %'
AND id NOT LIKE '%-box-%';

-- ============================================
-- STEP 7: Verify final configuration
-- ============================================

-- Display the final counts
DO $$
DECLARE
  loc RECORD;
  box_count INTEGER;
BEGIN
  RAISE NOTICE '=====================================';
  RAISE NOTICE 'Final Box Configuration:';
  RAISE NOTICE '=====================================';

  FOR loc IN SELECT id, name FROM booking_locations ORDER BY name LOOP
    SELECT COUNT(*) INTO box_count
    FROM booking_spaces
    WHERE location_id = loc.id;

    RAISE NOTICE '% (%): % boxes', loc.name, loc.id, box_count;
  END LOOP;

  RAISE NOTICE '=====================================';
END $$;

-- ============================================
-- STEP 8: Record migration
-- ============================================

-- Record this migration if migrations table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'migrations'
  ) THEN
    INSERT INTO migrations (filename, executed_at)
    VALUES ('312_fix_booking_boxes_safe.sql', NOW())
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END $$;

-- Commit the transaction
COMMIT;

-- ============================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================

-- Show final location and box configuration
SELECT
  bl.id as location_id,
  bl.name as location_name,
  COUNT(bs.id) as box_count,
  STRING_AGG(bs.name, ', ' ORDER BY bs.display_order) as boxes
FROM booking_locations bl
LEFT JOIN booking_spaces bs ON bl.id = bs.location_id
GROUP BY bl.id, bl.name
ORDER BY bl.name;

-- ============================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================

/*
-- To rollback this migration, run:

BEGIN;

-- Revert box names back to Bay
UPDATE booking_spaces
SET name = REPLACE(name, 'Box ', 'Bay ')
WHERE name LIKE 'Box %';

-- Restore River Oaks boxes
INSERT INTO booking_spaces (id, location_id, name, display_order, is_active, created_at, updated_at)
VALUES
  ('river-oaks-bay-2', 'river-oaks', 'Bay 2', 2, true, NOW(), NOW()),
  ('river-oaks-bay-3', 'river-oaks', 'Bay 3', 3, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Remove Truro Box 3
DELETE FROM booking_spaces
WHERE id = 'truro-box-3' OR (location_id = 'truro' AND name IN ('Box 3', 'Bay 3'));

-- Restore Halifax location
INSERT INTO booking_locations (id, name, city, is_active, created_at, updated_at)
VALUES ('halifax', 'Halifax', 'Halifax', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Rename Halifax (Bayers Lake) back to Bayers Lake
UPDATE booking_locations
SET name = 'Bayers Lake',
    city = 'Halifax'
WHERE id = 'bayers-lake';

COMMIT;
*/