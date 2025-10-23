-- Migration: Fix Booking System Customer Tiers
-- Description: Ensure customer_tier_id column exists and create missing indexes safely
-- Date: 2025-10-22

-- First, ensure customer_tiers table exists
CREATE TABLE IF NOT EXISTS customer_tiers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL,
  discount_percent INT DEFAULT 0,
  max_advance_days INT NOT NULL,
  allow_recurring BOOLEAN DEFAULT false,
  require_deposit BOOLEAN DEFAULT true,
  auto_upgrade_after INT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Insert default tiers if they don't exist
INSERT INTO customer_tiers (id, name, color, hourly_rate, max_advance_days, allow_recurring, auto_upgrade_after) VALUES
('new', 'New Customer', '#3B82F6', 30.00, 14, false, 3),
('member', 'Standard Member', '#FCD34D', 22.50, 30, true, NULL),
('promo', 'Promo User', '#10B981', 15.00, 14, false, NULL),
('frequent', 'Frequent Booker', '#8B5CF6', 20.00, 30, true, NULL)
ON CONFLICT (id) DO NOTHING;

-- Check if customer_tier_id column exists in bookings table, add it if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'bookings'
    AND column_name = 'customer_tier_id'
  ) THEN
    ALTER TABLE bookings
    ADD COLUMN customer_tier_id VARCHAR(50) REFERENCES customer_tiers(id);

    -- Set default tier for existing bookings
    UPDATE bookings
    SET customer_tier_id = 'new'
    WHERE customer_tier_id IS NULL;
  END IF;
END $$;

-- Drop indexes if they exist (to avoid errors on recreation)
DROP INDEX IF EXISTS idx_bookings_user_tier;
DROP INDEX IF EXISTS idx_bookings_dates;
DROP INDEX IF EXISTS idx_bookings_location;
DROP INDEX IF EXISTS idx_bookings_status;
DROP INDEX IF EXISTS idx_bookings_changes;

-- Create indexes safely (only if columns exist)
DO $$
BEGIN
  -- Check if both user_id and customer_tier_id exist before creating index
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'user_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'customer_tier_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_bookings_user_tier ON bookings(user_id, customer_tier_id);
  END IF;

  -- Create other indexes that should always work
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name IN ('start_at', 'end_at', 'start_time', 'end_time')
  ) THEN
    -- Try to create index on whichever columns exist
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'bookings' AND column_name = 'start_at'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_at, end_at);
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'bookings' AND column_name = 'start_time'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_time, end_time);
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'location_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_bookings_location ON bookings(location_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'change_count'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'flagged_for_changes'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_bookings_changes ON bookings(change_count)
    WHERE flagged_for_changes = true;
  END IF;
END $$;