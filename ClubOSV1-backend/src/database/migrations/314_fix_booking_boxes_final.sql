-- Migration: 314_fix_booking_boxes_final.sql
-- Date: 2025-10-06
-- Purpose: Final fix for booking boxes with proper handling of all constraints

BEGIN;

-- ============================================
-- STEP 1: Clean up spaces table first
-- ============================================

-- Delete any spaces referencing halifax location
DELETE FROM spaces WHERE location_id = 'halifax';

-- ============================================
-- STEP 2: Now we can delete halifax location
-- ============================================

DELETE FROM booking_locations WHERE id = 'halifax';

-- ============================================
-- STEP 3: Rename Bayers Lake to Halifax (Bayers Lake)
-- ============================================

UPDATE booking_locations
SET name = 'Halifax (Bayers Lake)',
    city = 'Halifax'
WHERE id = 'bayers-lake';

-- ============================================
-- STEP 4: Rename all Bays to Boxes
-- ============================================

UPDATE booking_spaces
SET name = REPLACE(name, 'Bay ', 'Box ')
WHERE name LIKE 'Bay %';

-- ============================================
-- STEP 5: Fix Truro - should have 3 boxes
-- ============================================

-- Add Box 3 to Truro if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM booking_spaces
    WHERE location_id = 'truro'
    AND (name = 'Box 3' OR name = 'Bay 3')
  ) THEN
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
  END IF;
END $$;

-- ============================================
-- STEP 6: Fix River Oaks - should have only 1 box
-- ============================================

DELETE FROM booking_spaces
WHERE location_id = 'river-oaks'
AND (name IN ('Box 2', 'Box 3', 'Box 4', 'Bay 2', 'Bay 3', 'Bay 4')
     OR display_order > 1);

-- ============================================
-- STEP 7: Update display order
-- ============================================

UPDATE booking_spaces
SET display_order = CAST(SUBSTRING(name FROM '[0-9]+') AS INTEGER)
WHERE name LIKE 'Box %';

-- ============================================
-- STEP 8: Show results
-- ============================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Final Box Configuration:';
  RAISE NOTICE '=====================================';

  FOR rec IN
    SELECT
      bl.name AS location_name,
      COUNT(bs.id) AS box_count,
      STRING_AGG(bs.name, ', ' ORDER BY bs.display_order) AS boxes
    FROM booking_locations bl
    LEFT JOIN booking_spaces bs ON bl.id = bs.location_id
    GROUP BY bl.name
    ORDER BY bl.name
  LOOP
    RAISE NOTICE '% : % boxes (%)', rec.location_name, rec.box_count, COALESCE(rec.boxes, 'none');
  END LOOP;

  RAISE NOTICE '=====================================';
END $$;

COMMIT;

-- Verification query
SELECT
  bl.name as "Location",
  COUNT(bs.id) as "Boxes",
  STRING_AGG(bs.name, ', ' ORDER BY bs.display_order) as "Box Names"
FROM booking_locations bl
LEFT JOIN booking_spaces bs ON bl.id = bs.location_id
GROUP BY bl.name
ORDER BY bl.name;