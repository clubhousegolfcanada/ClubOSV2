-- Migration: Add Booking Exclusion Constraint
-- Description: Prevents double bookings at the database level
-- Date: 2025-10-05
-- Critical: This fixes the production double-booking issue

-- Enable required extension for time range operations
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop existing constraint if it exists (for idempotency)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS prevent_double_booking;

-- Add exclusion constraint to prevent overlapping bookings
-- This makes it IMPOSSIBLE to have two bookings for the same location/space at the same time
ALTER TABLE bookings
ADD CONSTRAINT prevent_double_booking
EXCLUDE USING gist (
  location_id WITH =,
  tstzrange(start_at, end_at, '[)') WITH &&  -- [) means inclusive start, exclusive end
) WHERE (status IN ('confirmed', 'pending'));

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_bookings_time_range
ON bookings USING gist(tstzrange(start_at, end_at, '[)'));

CREATE INDEX IF NOT EXISTS idx_bookings_location_status
ON bookings(location_id, status)
WHERE status IN ('confirmed', 'pending');

CREATE INDEX IF NOT EXISTS idx_bookings_user_id_status
ON bookings(user_id, status)
WHERE status IN ('confirmed', 'pending');

-- Add function to check for space-specific conflicts (for multi-simulator bookings)
CREATE OR REPLACE FUNCTION check_space_availability(
  p_location_id VARCHAR(50),
  p_space_ids VARCHAR(50)[],
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_exclude_booking_id UUID DEFAULT NULL
) RETURNS TABLE(conflicting_space_id VARCHAR(50), conflicting_booking_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT
    unnest(b.space_ids) as conflicting_space_id,
    b.id as conflicting_booking_id
  FROM bookings b
  WHERE b.location_id = p_location_id
    AND b.status IN ('confirmed', 'pending')
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
    AND b.space_ids && p_space_ids;  -- Array overlap operator
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON CONSTRAINT prevent_double_booking ON bookings IS
'Critical constraint that prevents double bookings. DO NOT DROP without a replacement solution.';