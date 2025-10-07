-- Migration: 316_complete_box_naming.sql
-- Date: 2025-10-06
-- Purpose: Complete the Bay to Box renaming by fixing the database trigger issue
-- ==============================================================================

BEGIN;

-- Step 1: Drop the problematic trigger that's preventing updates
DROP TRIGGER IF EXISTS update_booking_spaces_updated_at ON booking_spaces;

-- Step 2: Add the missing updated_at column that the trigger expects
ALTER TABLE booking_spaces
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 3: Recreate the trigger properly
CREATE TRIGGER update_booking_spaces_updated_at
BEFORE UPDATE ON booking_spaces
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 4: Now rename all Bays to Boxes
UPDATE booking_spaces
SET name = REPLACE(name, 'Bay ', 'Box '),
    updated_at = CURRENT_TIMESTAMP
WHERE name LIKE 'Bay %';

-- Step 5: Verify the results
DO $$
DECLARE
    bay_count INTEGER;
    box_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO bay_count FROM booking_spaces WHERE name LIKE 'Bay %';
    SELECT COUNT(*) INTO box_count FROM booking_spaces WHERE name LIKE 'Box %';

    IF bay_count > 0 THEN
        RAISE NOTICE 'Warning: % spaces still named "Bay"', bay_count;
    END IF;

    RAISE NOTICE 'Success: % spaces now named "Box"', box_count;
END $$;

-- Display final results
SELECT
    bl.name as location,
    bs.name as box_name,
    bs.id
FROM booking_spaces bs
JOIN booking_locations bl ON bs.location_id = bl.id
ORDER BY bl.name, bs.display_order;

COMMIT;

-- ==============================================================================
-- ROLLBACK (if needed):
-- UPDATE booking_spaces SET name = REPLACE(name, 'Box ', 'Bay ') WHERE name LIKE 'Box %';
-- ALTER TABLE booking_spaces DROP COLUMN IF EXISTS updated_at;
-- ==============================================================================