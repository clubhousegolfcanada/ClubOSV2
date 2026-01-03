-- Migration: Create Booking System Tables
-- Description: Foundation for ClubOS booking system replacing Skedda
-- Date: 2025-10-05

-- Customer tiers with color coding
CREATE TABLE IF NOT EXISTS customer_tiers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL,  -- Hex color for calendar display
  hourly_rate DECIMAL(10,2) NOT NULL,
  discount_percent INT DEFAULT 0,
  max_advance_days INT NOT NULL,
  allow_recurring BOOLEAN DEFAULT false,
  require_deposit BOOLEAN DEFAULT true,
  auto_upgrade_after INT,  -- Number of bookings before auto-upgrade
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Insert default customer tiers
INSERT INTO customer_tiers (id, name, color, hourly_rate, max_advance_days, allow_recurring, auto_upgrade_after) VALUES
('new', 'New Customer', '#3B82F6', 30.00, 14, false, 3),        -- Blue
('member', 'Standard Member', '#FCD34D', 22.50, 30, true, NULL), -- Yellow
('promo', 'Promo User', '#10B981', 15.00, 14, false, NULL),     -- Green
('frequent', 'Frequent Booker', '#8B5CF6', 20.00, 30, true, NULL) -- Purple
ON CONFLICT (id) DO NOTHING;

-- Booking locations (simulators/courts)
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

-- Insert default locations
INSERT INTO booking_locations (id, name, city) VALUES
('bedford', 'Bedford', 'Bedford'),
('dartmouth', 'Dartmouth', 'Dartmouth'),
('river-oaks', 'River Oaks', 'River Oaks'),
('bayers-lake', 'Bayers Lake', 'Halifax'),
('stratford', 'Stratford', 'Stratford'),
('truro', 'Truro', 'Truro'),
('halifax', 'Halifax', 'Halifax')
ON CONFLICT (id) DO NOTHING;

-- Booking spaces (individual simulators/bays)
CREATE TABLE IF NOT EXISTS booking_spaces (
  id VARCHAR(50) PRIMARY KEY,
  location_id VARCHAR(50) REFERENCES booking_locations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(location_id, name)
);

-- Insert default spaces for each location
INSERT INTO booking_spaces (id, location_id, name, display_order) VALUES
-- Bedford (2 bays)
('bedford-1', 'bedford', 'Bay 1', 1),
('bedford-2', 'bedford', 'Bay 2', 2),
-- Dartmouth (4 bays)
('dartmouth-1', 'dartmouth', 'Bay 1', 1),
('dartmouth-2', 'dartmouth', 'Bay 2', 2),
('dartmouth-3', 'dartmouth', 'Bay 3', 3),
('dartmouth-4', 'dartmouth', 'Bay 4', 4),
-- River Oaks (3 bays)
('river-oaks-1', 'river-oaks', 'Bay 1', 1),
('river-oaks-2', 'river-oaks', 'Bay 2', 2),
('river-oaks-3', 'river-oaks', 'Bay 3', 3),
-- Bayers Lake (4 bays)
('bayers-lake-1', 'bayers-lake', 'Bay 1', 1),
('bayers-lake-2', 'bayers-lake', 'Bay 2', 2),
('bayers-lake-3', 'bayers-lake', 'Bay 3', 3),
('bayers-lake-4', 'bayers-lake', 'Bay 4', 4),
-- Stratford (3 bays)
('stratford-1', 'stratford', 'Bay 1', 1),
('stratford-2', 'stratford', 'Bay 2', 2),
('stratford-3', 'stratford', 'Bay 3', 3),
-- Truro (2 bays)
('truro-1', 'truro', 'Bay 1', 1),
('truro-2', 'truro', 'Bay 2', 2),
-- Halifax (3 bays)
('halifax-1', 'halifax', 'Bay 1', 1),
('halifax-2', 'halifax', 'Bay 2', 2),
('halifax-3', 'halifax', 'Bay 3', 3)
ON CONFLICT (id) DO NOTHING;

-- Main bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(50) REFERENCES booking_locations(id),
  space_ids VARCHAR(50)[] NOT NULL,  -- Array for multi-simulator bookings
  user_id UUID REFERENCES users(id),
  customer_tier_id VARCHAR(50) REFERENCES customer_tiers(id),
  customer_name VARCHAR(255),  -- For guest bookings
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),

  -- Time fields
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_at - start_at))::INT / 60
  ) STORED,

  -- Pricing
  base_rate DECIMAL(10,2),
  deposit_amount DECIMAL(10,2) DEFAULT 10.00,
  total_amount DECIMAL(10,2),
  promo_code VARCHAR(50),

  -- Change tracking
  change_count INT DEFAULT 0,
  change_fee_charged DECIMAL(10,2) DEFAULT 0,
  flagged_for_changes BOOLEAN DEFAULT false,

  -- Status
  status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no-show')),
  is_recurring BOOLEAN DEFAULT false,
  recurring_id UUID,  -- Links recurring bookings together

  -- Smart features
  upsell_sent BOOLEAN DEFAULT false,
  upsell_accepted BOOLEAN DEFAULT false,
  favorite_simulator VARCHAR(50),

  -- Admin features
  is_admin_block BOOLEAN DEFAULT false,
  block_reason VARCHAR(255),  -- For maintenance, cleaning, etc
  crm_notes TEXT,
  admin_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Create indexes for performance (IF NOT EXISTS for idempotency)
CREATE INDEX IF NOT EXISTS idx_bookings_user_tier ON bookings(user_id, customer_tier_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_bookings_location ON bookings(location_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_changes ON bookings(change_count) WHERE flagged_for_changes = true;

-- Prevent double bookings using exclusion constraint
-- Note: This requires btree_gist extension
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add constraint only if it doesn't exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prevent_double_booking'
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT prevent_double_booking
      EXCLUDE USING gist (
        location_id WITH =,
        space_ids WITH &&,
        tstzrange(start_at, end_at) WITH &&
      ) WHERE (status IN ('confirmed', 'pending') AND is_admin_block = false);
  END IF;
EXCEPTION
  WHEN undefined_function THEN
    -- GiST operator class not available for arrays, skip constraint
    RAISE NOTICE 'Skipping prevent_double_booking constraint - GiST array operators not available';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping prevent_double_booking constraint - %', SQLERRM;
END $$;

-- Location notices/alerts
CREATE TABLE IF NOT EXISTS location_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(50) REFERENCES booking_locations(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  active BOOLEAN DEFAULT true,
  show_until TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Loyalty tracking
CREATE TABLE IF NOT EXISTS loyalty_tracking (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  total_bookings INT DEFAULT 0,
  current_tier_id VARCHAR(50) REFERENCES customer_tiers(id),
  free_hours_earned INT DEFAULT 0,
  free_hours_used INT DEFAULT 0,
  last_tier_upgrade TIMESTAMPTZ,
  badges JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Smart upsell tracking
CREATE TABLE IF NOT EXISTS upsell_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  sent_at TIMESTAMPTZ,
  discount_offered DECIMAL(10,2),
  accepted BOOLEAN DEFAULT false,
  extended_minutes INT,
  revenue_generated DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Store booking configuration in system_settings
INSERT INTO system_settings (key, value, category) VALUES
('booking_config', '{
  "minDuration": 60,
  "incrementAfterFirst": 30,
  "maxDuration": 360,
  "gridInterval": 30,
  "snapInterval": 30,
  "bufferBefore": 5,
  "bufferAfter": 5,
  "allowCrossMidnight": true,
  "maxAdvanceBooking": 30,
  "requireDeposit": true,
  "depositAmount": 10,
  "changeFee": 10,
  "cancellationWindow": 24,
  "allowMultiSimulator": true,
  "dynamicPricing": true,
  "showPricing": true,
  "showPhotos": true,
  "groupByLocation": false,
  "showNotices": true,
  "upsellPrompts": {
    "enabled": true,
    "triggerMinutesBefore": 10,
    "triggerProbability": 0.4,
    "discountPercent": 20,
    "messageTemplate": "Having fun? Extend your session for 20% off!"
  },
  "loyaltyProgram": {
    "enabled": true,
    "freeAfterSessions": 10,
    "surpriseRewards": true,
    "badges": true
  }
}'::jsonb, 'booking')
ON CONFLICT (key) DO NOTHING;

-- Add trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customer_tiers_updated_at BEFORE UPDATE ON customer_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_locations_updated_at BEFORE UPDATE ON booking_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_location_notices_updated_at BEFORE UPDATE ON location_notices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_tracking_updated_at BEFORE UPDATE ON loyalty_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();