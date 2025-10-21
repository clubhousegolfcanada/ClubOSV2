-- Direct SQL to fix booking schema issue
-- Run this with: railway run psql $DATABASE_URL < scripts/run-booking-migration.sql

-- Add location_id column if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'bookings'
                   AND column_name = 'location_id') THEN
        ALTER TABLE bookings
        ADD COLUMN location_id VARCHAR(50);

        -- Set default location for existing bookings
        UPDATE bookings SET location_id = 'bedford' WHERE location_id IS NULL;

        RAISE NOTICE '✅ Added location_id column to bookings table';
    ELSE
        RAISE NOTICE '✅ location_id column already exists';
    END IF;
END $$;

-- Verify the fix
SELECT
    'Bookings table columns' as check_type,
    COUNT(*) as total_columns,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'location_id') as has_location_id
FROM information_schema.columns
WHERE table_name = 'bookings';

-- Show sample bookings
SELECT
    id,
    location_id,
    space_ids,
    start_at,
    status
FROM bookings
ORDER BY created_at DESC
LIMIT 5;