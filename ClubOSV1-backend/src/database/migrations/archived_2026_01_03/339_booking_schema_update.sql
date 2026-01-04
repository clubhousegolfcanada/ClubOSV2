-- Migration: 339_booking_schema_update.sql
-- Purpose: Update bookings table to new schema with all required columns
-- Author: ClubOS Migration System
-- Date: 2025-10-26
-- Description: Adds missing columns needed for the new booking system

BEGIN;

-- ============================================
-- 1. ADD NEW COLUMNS TO BOOKINGS TABLE
-- ============================================

-- Add location_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN location_id VARCHAR(50);
    UPDATE bookings SET location_id = 'bedford' WHERE location_id IS NULL;
    ALTER TABLE bookings ALTER COLUMN location_id SET NOT NULL;
    RAISE NOTICE 'Added location_id column to bookings table';
  END IF;
END $$;

-- Add space_ids if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'space_ids'
  ) THEN
    ALTER TABLE bookings ADD COLUMN space_ids INTEGER[];
    UPDATE bookings SET space_ids = ARRAY[1] WHERE space_ids IS NULL; -- Default to space 1
    ALTER TABLE bookings ALTER COLUMN space_ids SET NOT NULL;
    RAISE NOTICE 'Added space_ids column to bookings table';
  END IF;
END $$;

-- Add start_at if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'start_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN start_at TIMESTAMPTZ;
    -- Convert existing start_time to start_at
    UPDATE bookings SET start_at = start_time WHERE start_at IS NULL AND start_time IS NOT NULL;
    RAISE NOTICE 'Added start_at column to bookings table';
  END IF;
END $$;

-- Add end_at if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'end_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN end_at TIMESTAMPTZ;
    -- Calculate end_at from start_time and duration
    UPDATE bookings SET end_at = start_time + (duration || ' minutes')::INTERVAL
    WHERE end_at IS NULL AND start_time IS NOT NULL AND duration IS NOT NULL;
    RAISE NOTICE 'Added end_at column to bookings table';
  END IF;
END $$;

-- Add customer columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN customer_id INTEGER;
    RAISE NOTICE 'Added customer_id column to bookings table';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE bookings ADD COLUMN customer_name VARCHAR(255);
    RAISE NOTICE 'Added customer_name column to bookings table';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'customer_email'
  ) THEN
    ALTER TABLE bookings ADD COLUMN customer_email VARCHAR(255);
    RAISE NOTICE 'Added customer_email column to bookings table';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE bookings ADD COLUMN customer_phone VARCHAR(50);
    RAISE NOTICE 'Added customer_phone column to bookings table';
  END IF;
END $$;

-- Add pricing columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE bookings ADD COLUMN total_amount DECIMAL(10,2);
    RAISE NOTICE 'Added total_amount column to bookings table';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'base_rate'
  ) THEN
    ALTER TABLE bookings ADD COLUMN base_rate DECIMAL(10,2);
    RAISE NOTICE 'Added base_rate column to bookings table';
  END IF;
END $$;

-- Add admin block columns
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

-- Add customer tier
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'customer_tier_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN customer_tier_id INTEGER;
    RAISE NOTICE 'Added customer_tier_id column to bookings table';
  END IF;
END $$;

-- Add payment info columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE bookings ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending';
    RAISE NOTICE 'Added payment_status column to bookings table';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE bookings ADD COLUMN payment_method VARCHAR(50);
    RAISE NOTICE 'Added payment_method column to bookings table';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'confirmation_code'
  ) THEN
    ALTER TABLE bookings ADD COLUMN confirmation_code VARCHAR(20);
    RAISE NOTICE 'Added confirmation_code column to bookings table';
  END IF;
END $$;

-- ============================================
-- 2. CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_bookings_location_id ON bookings(location_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_email ON bookings(customer_email);
CREATE INDEX IF NOT EXISTS idx_bookings_start_at ON bookings(start_at);
CREATE INDEX IF NOT EXISTS idx_bookings_end_at ON bookings(end_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Show current bookings table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'bookings'
ORDER BY ordinal_position;