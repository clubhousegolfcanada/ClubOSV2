-- Migration: Fix Booking Boxes and Locations
-- Date: 2025-10-06
-- Purpose: Correct box naming and counts for each location

-- ============================================
-- UP MIGRATION
-- ============================================

BEGIN;

-- 1. First, migrate any bookings from duplicate halifax to bayers-lake
UPDATE bookings
SET location_id = 'bayers-lake'
WHERE location_id = 'halifax';

-- 2. Delete duplicate Halifax location's spaces first
DELETE FROM booking_spaces
WHERE location_id = 'halifax';

-- 3. Delete the duplicate Halifax location
DELETE FROM booking_locations
WHERE id = 'halifax';

-- 4. Update Bayers Lake location to be named Halifax (Bayers Lake)
UPDATE booking_locations
SET name = 'Halifax (Bayers Lake)',
    city = 'Halifax'
WHERE id = 'bayers-lake';

-- 5. Rename all "Bay" spaces to "Box"
UPDATE booking_spaces
SET name = REPLACE(name, 'Bay ', 'Box ')
WHERE name LIKE 'Bay %';

-- 6. Fix box counts for each location

-- Truro needs 3 boxes (currently has 2, add Box 3)
INSERT INTO booking_spaces (id, location_id, name, display_order, is_active, created_at, updated_at)
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
  WHERE location_id = 'truro' AND name = 'Box 3'
);

-- River Oaks should have only 1 box (remove Box 2 and Box 3)
DELETE FROM booking_spaces
WHERE location_id = 'river-oaks'
AND name IN ('Box 2', 'Box 3', 'Bay 2', 'Bay 3');

-- 7. Ensure proper display ordering for all boxes
UPDATE booking_spaces SET display_order = 1 WHERE name = 'Box 1';
UPDATE booking_spaces SET display_order = 2 WHERE name = 'Box 2';
UPDATE booking_spaces SET display_order = 3 WHERE name = 'Box 3';
UPDATE booking_spaces SET display_order = 4 WHERE name = 'Box 4';

-- 8. Add friendly IDs to boxes if they don't have them
-- This helps with consistent identification
UPDATE booking_spaces
SET id = CONCAT(location_id, '-box-', SUBSTRING(name FROM '[0-9]+'))
WHERE name LIKE 'Box %'
AND id NOT LIKE '%-box-%';

-- 9. Log the final state for verification
DO $$
BEGIN
  RAISE NOTICE 'Box configuration summary:';
  RAISE NOTICE 'Bedford: % boxes', (SELECT COUNT(*) FROM booking_spaces WHERE location_id = 'bedford');
  RAISE NOTICE 'Dartmouth: % boxes', (SELECT COUNT(*) FROM booking_spaces WHERE location_id = 'dartmouth');
  RAISE NOTICE 'Halifax (Bayers Lake): % boxes', (SELECT COUNT(*) FROM booking_spaces WHERE location_id = 'bayers-lake');
  RAISE NOTICE 'Truro: % boxes', (SELECT COUNT(*) FROM booking_spaces WHERE location_id = 'truro');
  RAISE NOTICE 'River Oaks: % boxes', (SELECT COUNT(*) FROM booking_spaces WHERE location_id = 'river-oaks');
  RAISE NOTICE 'Stratford: % boxes', (SELECT COUNT(*) FROM booking_spaces WHERE location_id = 'stratford');
END $$;

COMMIT;

-- ============================================
-- DOWN MIGRATION (Rollback)
-- ============================================

/*
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
SET name = 'Bayers Lake'
WHERE id = 'bayers-lake';

COMMIT;
*/