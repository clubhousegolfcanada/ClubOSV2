-- Migration: 338_comprehensive_booking_fix.sql
-- Purpose: Comprehensive booking system fix that handles any starting state
-- Author: ClubOS Migration System
-- Date: 2025-10-22

-- UP

BEGIN;

-- ============================================
-- 1. ENSURE BOOKINGS TABLE WITH PROPER SCHEMA
-- ============================================

-- Create bookings table if it doesn't exist
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  location_id INTEGER,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  space_ids INTEGER[],
  status VARCHAR(50) DEFAULT 'confirmed',
  payment_status VARCHAR(50) DEFAULT 'pending',
  amount_cents INTEGER,
  promo_code VARCHAR(100),
  discount_cents INTEGER,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migrate from old column names if they exist
DO $$
BEGIN
  -- Check for old simulator_id column and migrate to space_ids
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='bookings' AND column_name='simulator_id') THEN
    -- Add new column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='bookings' AND column_name='space_ids') THEN
      ALTER TABLE bookings ADD COLUMN space_ids INTEGER[];
    END IF;
    -- Migrate data
    UPDATE bookings SET space_ids = ARRAY[simulator_id]::INTEGER[]
    WHERE space_ids IS NULL AND simulator_id IS NOT NULL;
    -- Drop old column
    ALTER TABLE bookings DROP COLUMN IF EXISTS simulator_id;
  END IF;

  -- Check for old start_time column and migrate to start_at
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='bookings' AND column_name='start_time') THEN
    -- Add new column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='bookings' AND column_name='start_at') THEN
      ALTER TABLE bookings ADD COLUMN start_at TIMESTAMP WITH TIME ZONE;
    END IF;
    -- Migrate data
    UPDATE bookings SET start_at = start_time WHERE start_at IS NULL;
    -- Drop old column
    ALTER TABLE bookings DROP COLUMN IF EXISTS start_time;
  END IF;

  -- Check for duration column and convert to end_at
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='bookings' AND column_name='duration') THEN
    -- Add end_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='bookings' AND column_name='end_at') THEN
      ALTER TABLE bookings ADD COLUMN end_at TIMESTAMP WITH TIME ZONE;
    END IF;
    -- Calculate end_at from start_at + duration
    UPDATE bookings
    SET end_at = start_at + (duration || ' minutes')::INTERVAL
    WHERE end_at IS NULL AND duration IS NOT NULL AND start_at IS NOT NULL;
    -- Drop duration column
    ALTER TABLE bookings DROP COLUMN IF EXISTS duration;
  END IF;

  -- Add location_id column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='bookings' AND column_name='location_id') THEN
    ALTER TABLE bookings ADD COLUMN location_id INTEGER;
  END IF;

  -- Add space_ids column if still missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='bookings' AND column_name='space_ids') THEN
    ALTER TABLE bookings ADD COLUMN space_ids INTEGER[];
  END IF;
END $$;

-- ============================================
-- 2. CREATE BOOKING LOCATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS booking_locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  address TEXT,
  city VARCHAR(100),
  province VARCHAR(50),
  postal_code VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  time_zone VARCHAR(50) DEFAULT 'America/Halifax',
  operating_hours JSONB,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default locations if they don't exist
INSERT INTO booking_locations (name, city, province, is_active)
VALUES
  ('Bedford', 'Bedford', 'Nova Scotia', true),
  ('Dartmouth', 'Dartmouth', 'Nova Scotia', true),
  ('Halifax (Bayers Lake)', 'Halifax', 'Nova Scotia', true),
  ('Truro', 'Truro', 'Nova Scotia', true),
  ('River Oaks', 'Sydney River', 'Nova Scotia', true),
  ('Stratford', 'Stratford', 'Prince Edward Island', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 3. CREATE BOOKING SPACES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS booking_spaces (
  id SERIAL PRIMARY KEY,
  location_id INTEGER REFERENCES booking_locations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) DEFAULT 'simulator',
  capacity INTEGER DEFAULT 4,
  hourly_rate_cents INTEGER DEFAULT 3000,
  is_active BOOLEAN DEFAULT true,
  features JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(location_id, name)
);

-- Insert default spaces if they don't exist
DO $$
DECLARE
  bedford_id INTEGER;
  dartmouth_id INTEGER;
  halifax_id INTEGER;
  truro_id INTEGER;
  river_oaks_id INTEGER;
  stratford_id INTEGER;
BEGIN
  -- Get location IDs
  SELECT id INTO bedford_id FROM booking_locations WHERE name = 'Bedford';
  SELECT id INTO dartmouth_id FROM booking_locations WHERE name = 'Dartmouth';
  SELECT id INTO halifax_id FROM booking_locations WHERE name = 'Halifax (Bayers Lake)';
  SELECT id INTO truro_id FROM booking_locations WHERE name = 'Truro';
  SELECT id INTO river_oaks_id FROM booking_locations WHERE name = 'River Oaks';
  SELECT id INTO stratford_id FROM booking_locations WHERE name = 'Stratford';

  -- Insert spaces for each location
  -- Bedford - 2 boxes
  INSERT INTO booking_spaces (location_id, name, type) VALUES
    (bedford_id, 'Box 1', 'simulator'),
    (bedford_id, 'Box 2', 'simulator')
  ON CONFLICT (location_id, name) DO NOTHING;

  -- Dartmouth - 4 boxes
  INSERT INTO booking_spaces (location_id, name, type) VALUES
    (dartmouth_id, 'Box 1', 'simulator'),
    (dartmouth_id, 'Box 2', 'simulator'),
    (dartmouth_id, 'Box 3', 'simulator'),
    (dartmouth_id, 'Box 4', 'simulator')
  ON CONFLICT (location_id, name) DO NOTHING;

  -- Halifax - 4 boxes
  INSERT INTO booking_spaces (location_id, name, type) VALUES
    (halifax_id, 'Box 1', 'simulator'),
    (halifax_id, 'Box 2', 'simulator'),
    (halifax_id, 'Box 3', 'simulator'),
    (halifax_id, 'Box 4', 'simulator')
  ON CONFLICT (location_id, name) DO NOTHING;

  -- Truro - 3 boxes
  INSERT INTO booking_spaces (location_id, name, type) VALUES
    (truro_id, 'Box 1', 'simulator'),
    (truro_id, 'Box 2', 'simulator'),
    (truro_id, 'Box 3', 'simulator')
  ON CONFLICT (location_id, name) DO NOTHING;

  -- River Oaks - 1 box
  INSERT INTO booking_spaces (location_id, name, type) VALUES
    (river_oaks_id, 'Box 1', 'simulator')
  ON CONFLICT (location_id, name) DO NOTHING;

  -- Stratford - 3 boxes
  INSERT INTO booking_spaces (location_id, name, type) VALUES
    (stratford_id, 'Box 1', 'simulator'),
    (stratford_id, 'Box 2', 'simulator'),
    (stratford_id, 'Box 3', 'simulator')
  ON CONFLICT (location_id, name) DO NOTHING;
END $$;

-- ============================================
-- 4. CREATE CUSTOMER TIERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS customer_tiers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  hourly_rate_cents INTEGER NOT NULL,
  color VARCHAR(20),
  advance_booking_days INTEGER DEFAULT 14,
  can_book_recurring BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default tiers
INSERT INTO customer_tiers (name, hourly_rate_cents, color, advance_booking_days, can_book_recurring)
VALUES
  ('New Customer', 3000, 'blue', 14, false),
  ('Standard Member', 2250, 'yellow', 30, true),
  ('Promo Rate', 1500, 'green', 14, false),
  ('Frequent Player', 2000, 'purple', 30, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_location_id ON bookings(location_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_at ON bookings(start_at);
CREATE INDEX IF NOT EXISTS idx_bookings_end_at ON bookings(end_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_space_ids ON bookings USING GIN (space_ids);
CREATE INDEX IF NOT EXISTS idx_bookings_date_range ON bookings(start_at, end_at);

-- ============================================
-- 6. ADD EXCLUSION CONSTRAINT FOR NO DOUBLE BOOKINGS
-- ============================================

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add exclusion constraint to prevent double bookings (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'no_double_bookings'
  ) THEN
    ALTER TABLE bookings
    ADD CONSTRAINT no_double_bookings
    EXCLUDE USING gist (
      int4range(space_ids[1], space_ids[1], '[]') WITH &&,
      tstzrange(start_at, end_at, '[)') WITH &&
    ) WHERE (status != 'cancelled');
  END IF;
EXCEPTION
  WHEN others THEN
    -- If constraint creation fails (e.g., due to existing conflicts), log and continue
    RAISE NOTICE 'Could not create no_double_bookings constraint: %', SQLERRM;
END $$;

COMMIT;

-- DOWN
-- Rollback is intentionally minimal to prevent data loss
BEGIN;

-- We don't drop tables or columns in rollback to prevent data loss
-- Only remove constraints that might block operations

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS no_double_bookings;

COMMIT;