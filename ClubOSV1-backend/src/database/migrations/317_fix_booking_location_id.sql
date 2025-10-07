-- Migration: 317_fix_booking_location_id.sql
-- Date: 2025-10-07
-- Purpose: Add missing location_id column to bookings table if it doesn't exist
-- ==============================================================================

BEGIN;

-- Check and add location_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'bookings'
                   AND column_name = 'location_id') THEN
        ALTER TABLE bookings
        ADD COLUMN location_id VARCHAR(50) REFERENCES booking_locations(id);

        RAISE NOTICE 'Added location_id column to bookings table';
    ELSE
        RAISE NOTICE 'location_id column already exists in bookings table';
    END IF;
END $$;

-- Ensure booking_locations table exists and has data
CREATE TABLE IF NOT EXISTS booking_locations (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) DEFAULT 'America/Toronto',
  is_active BOOLEAN DEFAULT true,
  theme_color VARCHAR(7) DEFAULT '#0B3D3A',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Insert locations if they don't exist
INSERT INTO booking_locations (id, name, city) VALUES
('bedford', 'Bedford', 'Bedford'),
('dartmouth', 'Dartmouth', 'Dartmouth'),
('river-oaks', 'River Oaks', 'River Oaks'),
('bayers-lake', 'Halifax (Bayers Lake)', 'Halifax'),
('stratford', 'Stratford', 'Stratford'),
('truro', 'Truro', 'Truro')
ON CONFLICT (id) DO NOTHING;

-- Ensure booking_spaces table exists
CREATE TABLE IF NOT EXISTS booking_spaces (
  id VARCHAR(50) PRIMARY KEY,
  location_id VARCHAR(50) REFERENCES booking_locations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add updated_at column if missing (needed for trigger)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'booking_spaces'
                   AND column_name = 'updated_at') THEN
        ALTER TABLE booking_spaces
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Insert spaces if they don't exist
INSERT INTO booking_spaces (id, location_id, name, display_order) VALUES
-- Bedford (2 boxes)
('bedford-1', 'bedford', 'Box 1', 1),
('bedford-2', 'bedford', 'Box 2', 2),
-- Dartmouth (4 boxes)
('dartmouth-1', 'dartmouth', 'Box 1', 1),
('dartmouth-2', 'dartmouth', 'Box 2', 2),
('dartmouth-3', 'dartmouth', 'Box 3', 3),
('dartmouth-4', 'dartmouth', 'Box 4', 4),
-- River Oaks (1 box)
('river-oaks-1', 'river-oaks', 'Box 1', 1),
-- Halifax/Bayers Lake (4 boxes)
('bayers-lake-1', 'bayers-lake', 'Box 1', 1),
('bayers-lake-2', 'bayers-lake', 'Box 2', 2),
('bayers-lake-3', 'bayers-lake', 'Box 3', 3),
('bayers-lake-4', 'bayers-lake', 'Box 4', 4),
-- Stratford (3 boxes)
('stratford-1', 'stratford', 'Box 1', 1),
('stratford-2', 'stratford', 'Box 2', 2),
('stratford-3', 'stratford', 'Box 3', 3),
-- Truro (3 boxes)
('truro-1', 'truro', 'Box 1', 1),
('truro-2', 'truro', 'Box 2', 2),
('truro-3', 'truro', 'Box 3', 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- Ensure customer_tiers table exists
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

-- Insert default customer tiers
INSERT INTO customer_tiers (id, name, color, hourly_rate, max_advance_days, allow_recurring, auto_upgrade_after) VALUES
('new', 'New Customer', '#3B82F6', 30.00, 14, false, 3),
('member', 'Standard Member', '#FCD34D', 22.50, 30, true, NULL),
('promo', 'Promo User', '#10B981', 15.00, 14, false, NULL),
('frequent', 'Frequent Booker', '#8B5CF6', 20.00, 30, true, NULL)
ON CONFLICT (id) DO NOTHING;

-- Display results
SELECT
  'bookings' as table_name,
  COUNT(*) as columns,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'location_id') as has_location_id
FROM information_schema.columns
WHERE table_name = 'bookings';

SELECT
  bl.name as location,
  COUNT(bs.id) as box_count
FROM booking_locations bl
LEFT JOIN booking_spaces bs ON bl.id = bs.location_id
GROUP BY bl.id, bl.name
ORDER BY bl.name;

COMMIT;