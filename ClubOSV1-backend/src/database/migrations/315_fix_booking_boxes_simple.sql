-- Migration: 315_fix_booking_boxes_simple.sql
-- Date: 2025-10-06
-- Purpose: Simple and safe fix for booking boxes

-- NO TRANSACTION - execute each statement independently

-- ============================================
-- PART 1: Clean up duplicate halifax
-- ============================================

-- Delete spaces referencing halifax
DELETE FROM spaces WHERE location_id = 'halifax';

-- Delete halifax location
DELETE FROM booking_locations WHERE id = 'halifax';

-- ============================================
-- PART 2: Rename Bayers Lake
-- ============================================

UPDATE booking_locations
SET name = 'Halifax (Bayers Lake)',
    city = 'Halifax'
WHERE id = 'bayers-lake';

-- ============================================
-- PART 3: Rename Bays to Boxes
-- ============================================

UPDATE booking_spaces
SET name = REPLACE(name, 'Bay ', 'Box ')
WHERE name LIKE 'Bay %';

-- ============================================
-- PART 4: Add Box 3 to Truro
-- ============================================

INSERT INTO booking_spaces (
  id,
  location_id,
  name,
  display_order,
  is_active,
  created_at
)
SELECT
  'truro-box-3',
  'truro',
  'Box 3',
  3,
  true,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM booking_spaces
  WHERE location_id = 'truro'
  AND (name = 'Box 3' OR name = 'Bay 3')
);

-- ============================================
-- PART 5: Remove extra boxes from River Oaks
-- ============================================

DELETE FROM booking_spaces
WHERE location_id = 'river-oaks'
AND (name IN ('Box 2', 'Box 3', 'Box 4', 'Bay 2', 'Bay 3', 'Bay 4')
     OR display_order > 1);

-- ============================================
-- PART 6: Fix display order
-- ============================================

UPDATE booking_spaces
SET display_order = CAST(SUBSTRING(name FROM '[0-9]+') AS INTEGER)
WHERE name LIKE 'Box %';

-- ============================================
-- PART 7: Show final configuration
-- ============================================

SELECT
  bl.name as "Location",
  COUNT(bs.id) as "Boxes",
  STRING_AGG(bs.name, ', ' ORDER BY bs.display_order) as "Box Names"
FROM booking_locations bl
LEFT JOIN booking_spaces bs ON bl.id = bs.location_id
GROUP BY bl.name
ORDER BY bl.name;