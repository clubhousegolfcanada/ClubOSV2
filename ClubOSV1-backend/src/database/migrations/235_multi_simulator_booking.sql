-- Migration: Multi-Simulator Booking Support
-- Adds support for booking multiple simulators/spaces in a single transaction
-- Part 5 of the Booking System Master Plan

-- Create booking_locations table (if not exists)
CREATE TABLE IF NOT EXISTS booking_locations (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  city VARCHAR(100),
  address TEXT,
  timezone VARCHAR(50) DEFAULT 'America/Toronto',
  is_active BOOLEAN DEFAULT true,
  max_simulators INT DEFAULT 4,
  operating_hours JSONB DEFAULT '{"open": "06:00", "close": "22:00"}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create spaces table for individual simulators/boxes
CREATE TABLE IF NOT EXISTS spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(50) REFERENCES booking_locations(id),
  space_number INT NOT NULL,
  name VARCHAR(100),
  type VARCHAR(50) DEFAULT 'simulator', -- simulator, room, court, etc.
  features JSONB DEFAULT '[]', -- ["TrackMan", "Foresight", "GCQuad"]
  is_active BOOLEAN DEFAULT true,
  maintenance_notes TEXT,
  last_maintenance TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, space_number)
);

-- Create new bookings table with multi-simulator support
CREATE TABLE IF NOT EXISTS bookings_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(50) REFERENCES booking_locations(id),
  user_id UUID REFERENCES users(id),

  -- Multi-simulator support
  space_ids UUID[] NOT NULL, -- Array of space IDs
  primary_space_id UUID REFERENCES spaces(id), -- Main space for display

  -- Time fields
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_at - start_at)) / 60
  ) STORED,

  -- Booking details
  booking_type VARCHAR(20) DEFAULT 'standard', -- standard, group, full_location
  group_size INT DEFAULT 1,
  status VARCHAR(20) DEFAULT 'confirmed', -- confirmed, pending, cancelled, completed

  -- Customer tier tracking
  customer_tier VARCHAR(50) DEFAULT 'new', -- new, member, promo, frequent

  -- Change management
  change_count INT DEFAULT 0,
  original_booking_id UUID, -- For tracking reschedules
  flagged_for_changes BOOLEAN DEFAULT false,

  -- Favorites & preferences
  is_favorite_setup BOOLEAN DEFAULT false,
  notes TEXT,
  admin_notes TEXT,

  -- Pricing (to be implemented with payment system)
  base_rate DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  deposit_paid DECIMAL(10,2) DEFAULT 0,

  -- Metadata
  source VARCHAR(50) DEFAULT 'clubos', -- clubos, skedda, admin, api
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent double bookings using exclusion constraint
  -- This ensures no overlapping bookings for the same spaces
  EXCLUDE USING gist (
    space_ids WITH &&,
    tstzrange(start_at, end_at) WITH &&
  ) WHERE (status IN ('confirmed', 'pending'))
);

-- Create junction table for complex space relationships
CREATE TABLE IF NOT EXISTS booking_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings_v2(id) ON DELETE CASCADE,
  space_id UUID REFERENCES spaces(id),
  is_primary BOOLEAN DEFAULT false,
  participant_name VARCHAR(255), -- For group bookings
  participant_email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, space_id)
);

-- Add favorite simulator tracking to customer profiles
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS favorite_space_ids JSONB DEFAULT '{}';
-- Format: {"bedford": ["space-uuid-1"], "dartmouth": ["space-uuid-2", "space-uuid-3"]}

ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS booking_preferences JSONB DEFAULT '{}';
-- Format: {"default_duration": 60, "preferred_times": ["evening"], "auto_rebook": true}

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_v2_user ON bookings_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_v2_location ON bookings_v2(location_id);
CREATE INDEX IF NOT EXISTS idx_bookings_v2_dates ON bookings_v2(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_bookings_v2_status ON bookings_v2(status);
CREATE INDEX IF NOT EXISTS idx_bookings_v2_spaces ON bookings_v2 USING gin(space_ids);
CREATE INDEX IF NOT EXISTS idx_booking_spaces_booking ON booking_spaces(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_spaces_space ON booking_spaces(space_id);
CREATE INDEX IF NOT EXISTS idx_spaces_location ON spaces(location_id);

-- Create availability view for quick checks
CREATE OR REPLACE VIEW space_availability AS
SELECT
  s.id as space_id,
  s.location_id,
  s.name as space_name,
  s.space_number,
  b.start_at,
  b.end_at,
  b.status,
  b.user_id,
  u.email as booked_by
FROM spaces s
LEFT JOIN bookings_v2 b ON s.id = ANY(b.space_ids) AND b.status IN ('confirmed', 'pending')
LEFT JOIN users u ON b.user_id = u.id
WHERE s.is_active = true
ORDER BY s.location_id, s.space_number, b.start_at;

-- Insert default locations if not exists
INSERT INTO booking_locations (id, name, city, max_simulators) VALUES
  ('bedford', 'Bedford', 'Bedford', 4),
  ('dartmouth', 'Dartmouth', 'Dartmouth', 4),
  ('hammonds_plains', 'Hammonds Plains', 'Hammonds Plains', 4),
  ('sackville', 'Lower Sackville', 'Lower Sackville', 4),
  ('clayton_park', 'Clayton Park', 'Halifax', 4),
  ('river_oaks', 'River Oaks', 'River Oaks', 4)
ON CONFLICT (id) DO NOTHING;

-- Create spaces for each location (4 simulators each)
INSERT INTO spaces (location_id, space_number, name, type)
SELECT
  l.id,
  s.num,
  CONCAT('Simulator ', s.num),
  'simulator'
FROM booking_locations l
CROSS JOIN generate_series(1, 4) AS s(num)
WHERE NOT EXISTS (
  SELECT 1 FROM spaces
  WHERE location_id = l.id AND space_number = s.num
);

-- Function to check space availability
CREATE OR REPLACE FUNCTION check_space_availability(
  p_space_ids UUID[],
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM bookings_v2
    WHERE space_ids && p_space_ids -- Arrays overlap
      AND tstzrange(start_at, end_at) && tstzrange(p_start_at, p_end_at) -- Time ranges overlap
      AND status IN ('confirmed', 'pending')
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get available spaces for a time slot
CREATE OR REPLACE FUNCTION get_available_spaces(
  p_location_id VARCHAR(50),
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
)
RETURNS TABLE (
  space_id UUID,
  space_number INT,
  space_name VARCHAR(100),
  is_available BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.space_number,
    s.name,
    check_space_availability(ARRAY[s.id], p_start_at, p_end_at) as is_available
  FROM spaces s
  WHERE s.location_id = p_location_id
    AND s.is_active = true
  ORDER BY s.space_number;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bookings_v2_updated_at
  BEFORE UPDATE ON bookings_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_spaces_updated_at
  BEFORE UPDATE ON spaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_booking_locations_updated_at
  BEFORE UPDATE ON booking_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON bookings_v2 TO authenticated;
GRANT SELECT ON spaces TO authenticated;
GRANT SELECT ON booking_locations TO authenticated;
GRANT SELECT ON space_availability TO authenticated;

-- Add comment
COMMENT ON TABLE bookings_v2 IS 'Multi-simulator booking support - Part 5 of Booking System Master Plan';