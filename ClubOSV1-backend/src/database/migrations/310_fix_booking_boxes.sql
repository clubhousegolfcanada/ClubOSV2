-- Migration: Fix booking locations and rename Bays to Boxes
-- Date: 2025-10-06
-- Description: Updates booking system to use "Box" naming for simulator bays
-- and consolidates Halifax locations

-- UP

-- First, check if any bookings reference the duplicate halifax location
-- and move them to bayers-lake
UPDATE bookings
SET location_id = 'bayers-lake'
WHERE location_id = 'halifax';

-- Delete the duplicate Halifax location (keep bayers-lake which will be renamed)
DELETE FROM booking_spaces WHERE location_id = 'halifax';
DELETE FROM booking_locations WHERE id = 'halifax';

-- Rename Bayers Lake to Halifax (since Bayers Lake is in Halifax)
UPDATE booking_locations
SET name = 'Halifax (Bayers Lake)',
    city = 'Halifax'
WHERE id = 'bayers-lake';

-- Rename all "Bay" spaces to "Box"
UPDATE booking_spaces
SET name = REPLACE(name, 'Bay ', 'Box ')
WHERE name LIKE 'Bay %';

-- Now fix the box counts per location:

-- Bedford: Keep 2 boxes (Box 1 and Box 2) - already correct

-- Dartmouth: Keep 4 boxes - already correct

-- Halifax (Bayers Lake): Keep 4 boxes - already correct

-- Truro: Should have 3 boxes (currently has 2, need to add Box 3)
INSERT INTO booking_spaces (id, location_id, name, description, capacity, features, is_active, display_order, created_at, updated_at)
VALUES (
  'truro-box-3',
  'truro',
  'Box 3',
  'Simulator Box 3',
  4,
  '["TrackMan", "Lounge Seating", "Premium Sound"]',
  true,
  3,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- River Oaks: Should have only 1 box (currently has 3, remove Box 2 and Box 3)
DELETE FROM booking_spaces
WHERE location_id = 'river-oaks'
AND name IN ('Box 2', 'Box 3');

-- Stratford: Keep 3 boxes - already correct

-- Update display orders to ensure proper ordering
UPDATE booking_spaces SET display_order = 1 WHERE name = 'Box 1';
UPDATE booking_spaces SET display_order = 2 WHERE name = 'Box 2';
UPDATE booking_spaces SET display_order = 3 WHERE name = 'Box 3';
UPDATE booking_spaces SET display_order = 4 WHERE name = 'Box 4';

-- Add better descriptions for all boxes
UPDATE booking_spaces
SET description = CONCAT('Golf Simulator ', name, ' - Premium TrackMan experience')
WHERE description IS NULL OR description = '';

-- DOWN

-- Revert box names back to Bay
UPDATE booking_spaces
SET name = REPLACE(name, 'Box ', 'Bay ')
WHERE name LIKE 'Box %';

-- Restore River Oaks boxes
INSERT INTO booking_spaces (id, location_id, name, description, capacity, features, is_active, display_order, created_at, updated_at)
VALUES
  ('river-oaks-bay-2', 'river-oaks', 'Bay 2', 'Simulator Bay 2', 4, '["TrackMan"]', true, 2, NOW(), NOW()),
  ('river-oaks-bay-3', 'river-oaks', 'Bay 3', 'Simulator Bay 3', 4, '["TrackMan"]', true, 3, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Remove Truro Box 3
DELETE FROM booking_spaces WHERE id = 'truro-box-3';

-- Restore Halifax location
INSERT INTO booking_locations (id, name, city, timezone, address, phone, hours, is_active, theme, created_at, updated_at)
SELECT 'halifax', 'Halifax', 'Halifax', timezone, address, phone, hours, is_active, theme, NOW(), NOW()
FROM booking_locations WHERE id = 'bayers-lake';

-- Rename Bayers Lake back
UPDATE booking_locations
SET name = 'Bayers Lake'
WHERE id = 'bayers-lake';