-- Migration: Add booking locations and notices system
-- Part 4 of Booking System Master Plan
-- Purpose: Enable multi-location management with notices and alerts

-- Create booking_locations table
CREATE TABLE IF NOT EXISTS booking_locations (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip VARCHAR(10),
  phone VARCHAR(20),
  email VARCHAR(255),

  -- Operating hours (stored as HH:MM format)
  opens_at TIME DEFAULT '06:00',
  closes_at TIME DEFAULT '22:00',

  -- Visibility settings
  is_visible BOOLEAN DEFAULT true,  -- Show/hide location from customers
  is_active BOOLEAN DEFAULT true,   -- Location operational status

  -- Location-specific settings
  min_booking_hours INT DEFAULT 1,  -- Minimum booking duration in hours
  max_advance_days INT DEFAULT 30,  -- How far ahead can book
  deposit_amount DECIMAL(10,2) DEFAULT 10.00,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Clubhouse 24/7 locations
INSERT INTO booking_locations (id, name, city, state, is_visible, is_active) VALUES
  ('bellaire', 'Bellaire', 'Bellaire', 'TX', true, true),
  ('heights', 'Heights', 'Houston', 'TX', true, true),
  ('river-oaks', 'River Oaks', 'Houston', 'TX', true, true),
  ('woodlands', 'The Woodlands', 'The Woodlands', 'TX', true, true),
  ('cypress', 'Cypress', 'Cypress', 'TX', true, true),
  ('memorial', 'Memorial', 'Houston', 'TX', true, true)
ON CONFLICT (id) DO NOTHING;

-- Create location_notices table for alerts and announcements
CREATE TABLE IF NOT EXISTS location_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(50) REFERENCES booking_locations(id) ON DELETE CASCADE,

  -- Notice content
  title VARCHAR(200),
  message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),

  -- Display settings
  is_active BOOLEAN DEFAULT true,
  show_on_booking_page BOOLEAN DEFAULT true,
  show_in_confirmations BOOLEAN DEFAULT true,
  show_until TIMESTAMPTZ,  -- Optional expiry date

  -- Admin tracking
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create booking_config table for location-specific configuration
CREATE TABLE IF NOT EXISTS booking_config (
  location_id VARCHAR(50) PRIMARY KEY REFERENCES booking_locations(id) ON DELETE CASCADE,

  -- Time settings
  min_duration_minutes INT DEFAULT 60,
  increment_minutes INT DEFAULT 30,  -- After minimum, book in these increments
  min_advance_notice_hours INT DEFAULT 1,  -- Can't book less than X hours ahead

  -- Business rules
  allow_cross_midnight BOOLEAN DEFAULT false,
  allow_recurring BOOLEAN DEFAULT true,
  max_recurring_weeks INT DEFAULT 12,

  -- Change management
  free_reschedule_count INT DEFAULT 1,
  reschedule_fee DECIMAL(10,2) DEFAULT 10.00,
  max_changes_allowed INT DEFAULT 2,
  flag_after_changes INT DEFAULT 2,

  -- Smart features
  enable_upsell_prompts BOOLEAN DEFAULT true,
  upsell_trigger_percent INT DEFAULT 40,  -- Trigger upsell X% of the time
  upsell_minutes_before_end INT DEFAULT 10,

  -- Loyalty settings
  sessions_for_free_hour INT DEFAULT 10,
  auto_upgrade_after_bookings INT DEFAULT 3,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize booking config for all locations with defaults
INSERT INTO booking_config (location_id)
SELECT id FROM booking_locations
ON CONFLICT (location_id) DO NOTHING;

-- Create booking_spaces table for simulators/courts per location
CREATE TABLE IF NOT EXISTS booking_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(50) REFERENCES booking_locations(id) ON DELETE CASCADE,

  -- Space details
  name VARCHAR(100) NOT NULL,  -- "Simulator 1", "Court A", etc.
  type VARCHAR(50) DEFAULT 'simulator',  -- simulator, court, room
  capacity INT DEFAULT 4,

  -- Features
  features JSONB DEFAULT '[]',  -- ["TrackMan", "Projector", "Premium"]
  is_premium BOOLEAN DEFAULT false,
  premium_rate_multiplier DECIMAL(3,2) DEFAULT 1.0,  -- 1.5 = 50% more expensive

  -- Availability
  is_active BOOLEAN DEFAULT true,
  is_bookable BOOLEAN DEFAULT true,

  -- Display
  display_order INT DEFAULT 0,
  color_hex VARCHAR(7),  -- Optional custom color for calendar

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add sample spaces for each location (can be customized later)
INSERT INTO booking_spaces (location_id, name, type, display_order)
SELECT
  l.id,
  'Simulator ' || s.num,
  'simulator',
  s.num
FROM booking_locations l
CROSS JOIN generate_series(1, 4) AS s(num)
WHERE l.is_active = true
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_location_notices_active
  ON location_notices(location_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_location_notices_expiry
  ON location_notices(show_until)
  WHERE show_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_booking_locations_visible
  ON booking_locations(is_visible, is_active)
  WHERE is_visible = true AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_booking_spaces_location
  ON booking_spaces(location_id, is_active, is_bookable)
  WHERE is_active = true AND is_bookable = true;

-- Create function to auto-expire notices
CREATE OR REPLACE FUNCTION expire_old_notices() RETURNS void AS $$
BEGIN
  UPDATE location_notices
  SET is_active = false
  WHERE show_until IS NOT NULL
    AND show_until < NOW()
    AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_booking_locations_updated_at
  BEFORE UPDATE ON booking_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_location_notices_updated_at
  BEFORE UPDATE ON location_notices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_config_updated_at
  BEFORE UPDATE ON booking_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_spaces_updated_at
  BEFORE UPDATE ON booking_spaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();