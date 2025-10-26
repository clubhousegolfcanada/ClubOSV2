-- Migration: 340_fix_booking_columns.sql
-- Purpose: Fix missing columns in bookings table for v1.24.26
-- Author: ClubOS Migration System
-- Date: 2025-10-26
-- Description: Adds missing columns required by the new booking system

BEGIN;

-- ============================================
-- 1. ADD MISSING COLUMNS TO BOOKINGS TABLE
-- ============================================

-- Add base_rate column (for storing the base hourly rate)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'base_rate'
  ) THEN
    ALTER TABLE bookings ADD COLUMN base_rate DECIMAL(10,2) DEFAULT 0;
    RAISE NOTICE 'Added base_rate column to bookings table';
  END IF;
END $$;

-- Add is_admin_block column (for admin time blocks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'is_admin_block'
  ) THEN
    ALTER TABLE bookings ADD COLUMN is_admin_block BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added is_admin_block column to bookings table';
  END IF;
END $$;

-- Add block_reason column (reason for admin blocks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'block_reason'
  ) THEN
    ALTER TABLE bookings ADD COLUMN block_reason TEXT;
    RAISE NOTICE 'Added block_reason column to bookings table';
  END IF;
END $$;

-- Add admin_notes column if missing (for storing JSON metadata)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE bookings ADD COLUMN admin_notes TEXT;
    RAISE NOTICE 'Added admin_notes column to bookings table';
  END IF;
END $$;

-- Ensure customer_tier_id exists and has proper reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'customer_tier_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN customer_tier_id VARCHAR(50);
    RAISE NOTICE 'Added customer_tier_id column to bookings table';
  END IF;
END $$;

-- ============================================
-- 2. CREATE CHECK_SPACE_AVAILABILITY FUNCTION
-- ============================================

-- Drop function if exists (to recreate with proper signature)
DROP FUNCTION IF EXISTS check_space_availability(VARCHAR, INTEGER[], TIMESTAMPTZ, TIMESTAMPTZ);

-- Create the function for checking space availability
CREATE OR REPLACE FUNCTION check_space_availability(
  p_location_id VARCHAR,
  p_space_ids INTEGER[],
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
)
RETURNS TABLE(
  conflicting_space_id INTEGER,
  conflicting_booking_id INTEGER,
  conflict_start TIMESTAMPTZ,
  conflict_end TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    UNNEST(b.space_ids) AS conflicting_space_id,
    b.id AS conflicting_booking_id,
    b.start_at AS conflict_start,
    b.end_at AS conflict_end
  FROM bookings b
  WHERE b.location_id = p_location_id
    AND b.status IN ('confirmed', 'pending')
    AND b.space_ids && p_space_ids  -- Array overlap operator
    AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
  ORDER BY b.start_at;
END;
$$;

COMMENT ON FUNCTION check_space_availability IS 'Checks if the requested spaces are available for booking in the given time range';

-- ============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Create index for admin blocks if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_bookings_admin_blocks
ON bookings(is_admin_block)
WHERE is_admin_block = TRUE;

-- Create index for base_rate queries
CREATE INDEX IF NOT EXISTS idx_bookings_base_rate
ON bookings(base_rate)
WHERE base_rate > 0;

-- Create composite index for space availability checks
CREATE INDEX IF NOT EXISTS idx_bookings_space_availability
ON bookings(location_id, status, start_at, end_at)
WHERE status IN ('confirmed', 'pending');

-- Create GIN index for space_ids array searches (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'bookings'
    AND indexname = 'idx_bookings_space_ids_gin'
  ) THEN
    CREATE INDEX idx_bookings_space_ids_gin ON bookings USING GIN (space_ids);
    RAISE NOTICE 'Created GIN index for space_ids array searches';
  END IF;
END $$;

-- ============================================
-- 4. UPDATE EXISTING DATA WITH DEFAULTS
-- ============================================

-- Set default base_rate for existing bookings based on tier
UPDATE bookings b
SET base_rate = COALESCE(
  (SELECT ct.hourly_rate
   FROM customer_tiers ct
   WHERE ct.id = b.customer_tier_id),
  30.00  -- Default rate if no tier found
)
WHERE base_rate IS NULL OR base_rate = 0;

-- Set is_admin_block to false for all existing bookings
UPDATE bookings
SET is_admin_block = FALSE
WHERE is_admin_block IS NULL;

-- Set default customer_tier_id for bookings without one
UPDATE bookings
SET customer_tier_id = 'new'
WHERE customer_tier_id IS NULL;

-- ============================================
-- 5. ADD CONSTRAINTS
-- ============================================

-- Add check constraint to ensure admin blocks have a reason
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS check_admin_block_reason;
ALTER TABLE bookings ADD CONSTRAINT check_admin_block_reason
CHECK (
  (is_admin_block = FALSE) OR
  (is_admin_block = TRUE AND block_reason IS NOT NULL)
);

-- Add check constraint for base_rate
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS check_base_rate_positive;
ALTER TABLE bookings ADD CONSTRAINT check_base_rate_positive
CHECK (base_rate >= 0);

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify all required columns exist
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN ('base_rate', 'is_admin_block', 'block_reason', 'customer_tier_id', 'admin_notes', 'space_ids')
ORDER BY column_name;

-- Verify function exists
SELECT
  proname AS function_name,
  pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname = 'check_space_availability';

-- Show index status
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'bookings'
  AND indexname IN ('idx_bookings_admin_blocks', 'idx_bookings_base_rate', 'idx_bookings_space_availability', 'idx_bookings_space_ids_gin')
ORDER BY indexname;