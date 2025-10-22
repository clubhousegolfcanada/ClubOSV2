-- Migration: 336_fix_booking_space_ids.sql
-- Date: 2025-10-22
-- Purpose: Emergency fix - Add missing space_ids column to bookings table
-- ==============================================================================

BEGIN;

-- Check if space_ids column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'bookings'
        AND column_name = 'space_ids'
    ) THEN
        -- Add the space_ids column as an array of VARCHAR to match booking_spaces table
        ALTER TABLE bookings
        ADD COLUMN space_ids VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR(50)[];

        -- If there's a legacy single space_id column, migrate the data
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'bookings'
            AND column_name = 'space_id'
        ) THEN
            -- Migrate single space_id to array format
            UPDATE bookings
            SET space_ids = ARRAY[space_id]::VARCHAR(50)[]
            WHERE space_id IS NOT NULL;

            RAISE NOTICE '✅ Migrated single space_id to space_ids array';
        END IF;

        -- If there's a legacy simulator_id column, migrate that too
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'bookings'
            AND column_name = 'simulator_id'
        ) THEN
            -- Migrate simulator_id to space_ids array
            UPDATE bookings
            SET space_ids = ARRAY[simulator_id::VARCHAR(50)]
            WHERE simulator_id IS NOT NULL
            AND (space_ids IS NULL OR array_length(space_ids, 1) = 0);

            RAISE NOTICE '✅ Migrated simulator_id to space_ids array';
        END IF;

        RAISE NOTICE '✅ Added space_ids column to bookings table';
    ELSE
        RAISE NOTICE 'ℹ️ space_ids column already exists';
    END IF;
END $$;

-- Ensure the column is NOT NULL (but allow empty arrays)
ALTER TABLE bookings
ALTER COLUMN space_ids SET NOT NULL,
ALTER COLUMN space_ids SET DEFAULT ARRAY[]::VARCHAR(50)[];

-- Create index for better performance on space_ids searches
CREATE INDEX IF NOT EXISTS idx_bookings_space_ids ON bookings USING GIN (space_ids);

-- Add some safety constraints
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS check_space_ids_not_empty;
-- Note: We're NOT adding a constraint that requires non-empty arrays
-- because admin blocks might apply to all spaces (empty array = all)

COMMIT;

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 336_fix_booking_space_ids completed successfully';
    RAISE NOTICE 'ℹ️ Bookings table now has proper space_ids array column';
END $$;