-- Migration 238: Comprehensive Booking System Tables
-- Date: 2025-10-05
-- Purpose: Complete database schema for native booking system to replace Skedda

-- ============================================
-- 1. BOOKING LOCATIONS (6 facilities)
-- ============================================
CREATE TABLE IF NOT EXISTS booking_locations (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  timezone VARCHAR(50) DEFAULT 'America/Chicago',
  is_visible BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Clubhouse locations
INSERT INTO booking_locations (id, name, address, sort_order) VALUES
  ('river-oaks', 'River Oaks', '2001 Kirby Dr, Houston, TX 77019', 1),
  ('heights', 'Heights', '1533 N Shepherd Dr, Houston, TX 77008', 2),
  ('energy-corridor', 'Energy Corridor', '1111 Eldridge Pkwy, Houston, TX 77077', 3),
  ('midtown', 'Midtown', '3100 Travis St, Houston, TX 77006', 4),
  ('galleria', 'Galleria', '5085 Westheimer Rd, Houston, TX 77056', 5),
  ('woodlands', 'The Woodlands', '10001 Woodloch Forest Dr, The Woodlands, TX 77380', 6)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. BOOKING SPACES (Simulators/Bays)
-- ============================================
CREATE TABLE IF NOT EXISTS booking_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(50) REFERENCES booking_locations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  space_type VARCHAR(50) DEFAULT 'simulator', -- simulator, pickleball, gym, etc
  capacity INT DEFAULT 4,
  hourly_rate DECIMAL(10,2) DEFAULT 30.00,
  is_active BOOLEAN DEFAULT true,
  features JSONB DEFAULT '[]', -- ["TrackMan", "Putting Green", etc]
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. CUSTOMER TIERS WITH COLOR CODING
-- ============================================
CREATE TABLE IF NOT EXISTS customer_tiers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL, -- Hex color for calendar display
  hourly_rate DECIMAL(10,2),
  discount_percent INT DEFAULT 0,
  max_advance_days INT DEFAULT 14,
  allow_recurring BOOLEAN DEFAULT false,
  require_deposit BOOLEAN DEFAULT true,
  deposit_amount DECIMAL(10,2) DEFAULT 10.00,
  auto_upgrade_after INT, -- Number of bookings to auto-upgrade
  perks JSONB DEFAULT '[]', -- ["early_access", "hidden_slots", etc]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default tiers with color coding
INSERT INTO customer_tiers (id, name, color, hourly_rate, max_advance_days, allow_recurring, auto_upgrade_after) VALUES
  ('new', 'New Customer', '#3B82F6', 30.00, 14, false, 3),      -- Blue
  ('member', 'Standard Member', '#FCD34D', 22.50, 30, true, NULL),  -- Yellow
  ('promo', 'Promo User', '#10B981', 15.00, 14, false, NULL),      -- Green
  ('frequent', 'Frequent Booker', '#8B5CF6', 20.00, 30, true, NULL) -- Purple
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. ENHANCED BOOKINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Location and Space
  location_id VARCHAR(50) REFERENCES booking_locations(id),
  space_ids UUID[] NOT NULL, -- Array for multi-simulator bookings

  -- User and Tier
  user_id UUID REFERENCES users(id),
  customer_tier_id VARCHAR(50) REFERENCES customer_tiers(id),
  booked_for_name VARCHAR(255), -- For staff booking on behalf of customer
  booked_for_phone VARCHAR(20),
  booked_by_user_id UUID REFERENCES users(id), -- Staff member who made booking

  -- Time Fields
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_at - start_at)) / 60
  ) STORED,

  -- Pricing and Payments
  base_rate DECIMAL(10,2),
  discount_amount DECIMAL(10,2) DEFAULT 0,
  deposit_amount DECIMAL(10,2) DEFAULT 10.00,
  deposit_paid BOOLEAN DEFAULT false,
  total_amount DECIMAL(10,2),
  promo_code VARCHAR(50),
  gift_card_used DECIMAL(10,2) DEFAULT 0,

  -- Change Management
  change_count INT DEFAULT 0,
  change_fee_charged DECIMAL(10,2) DEFAULT 0,
  flagged_for_changes BOOLEAN DEFAULT false,
  last_changed_at TIMESTAMPTZ,

  -- Booking Status
  status VARCHAR(20) DEFAULT 'confirmed', -- confirmed, pending, cancelled, no_show, completed
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id),

  -- Recurring Bookings
  is_recurring BOOLEAN DEFAULT false,
  recurring_id UUID, -- Links all bookings in a recurring series
  recurrence_rule JSONB, -- {"frequency": "weekly", "days": [1,3,5], "until": "2025-12-31"}

  -- Smart Features
  upsell_sent BOOLEAN DEFAULT false,
  upsell_sent_at TIMESTAMPTZ,
  upsell_accepted BOOLEAN DEFAULT false,
  extended_minutes INT DEFAULT 0,
  favorite_simulator UUID REFERENCES booking_spaces(id),

  -- Notes and Metadata
  customer_notes TEXT, -- Customer's booking notes
  crm_notes TEXT, -- Staff-only behavior notes
  admin_notes TEXT, -- Admin-only notes
  block_reason VARCHAR(100), -- For admin block-offs (cleaning, maintenance, etc)
  is_admin_block BOOLEAN DEFAULT false,

  -- Notifications
  confirmation_sent BOOLEAN DEFAULT false,
  reminder_sent BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index to prevent double bookings using GiST
CREATE INDEX IF NOT EXISTS idx_bookings_no_overlap ON bookings
  USING gist (tstzrange(start_at, end_at, '[)'));

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_bookings_user_tier ON bookings(user_id, customer_tier_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status) WHERE status IN ('confirmed', 'pending');
CREATE INDEX IF NOT EXISTS idx_bookings_location ON bookings(location_id);
CREATE INDEX IF NOT EXISTS idx_bookings_changes ON bookings(change_count) WHERE flagged_for_changes = true;

-- ============================================
-- 5. LOCATION NOTICES & ALERTS
-- ============================================
CREATE TABLE IF NOT EXISTS location_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(50) REFERENCES booking_locations(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'info', -- info, warning, critical
  active BOOLEAN DEFAULT true,
  show_in_booking BOOLEAN DEFAULT true, -- Show during booking process
  show_in_confirmation BOOLEAN DEFAULT true, -- Include in confirmations
  show_until TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. LOYALTY TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS loyalty_tracking (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  total_bookings INT DEFAULT 0,
  completed_bookings INT DEFAULT 0,
  current_tier_id VARCHAR(50) REFERENCES customer_tiers(id),
  previous_tier_id VARCHAR(50) REFERENCES customer_tiers(id),

  -- Rewards
  free_hours_earned INT DEFAULT 0,
  free_hours_used INT DEFAULT 0,
  loyalty_points INT DEFAULT 0,

  -- Milestones
  last_tier_upgrade TIMESTAMPTZ,
  next_reward_at INT, -- Bookings until next reward
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,

  -- Badges and Achievements
  badges JSONB DEFAULT '[]',
  achievements JSONB DEFAULT '[]',

  -- Stats
  total_spend DECIMAL(10,2) DEFAULT 0,
  average_booking_duration INT DEFAULT 0,
  favorite_location VARCHAR(50),
  favorite_time_slot VARCHAR(20), -- morning, afternoon, evening

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tier ON loyalty_tracking(current_tier_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_user ON loyalty_tracking(user_id);

-- ============================================
-- 7. SMART UPSELL TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS upsell_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),

  -- Upsell Details
  sent_at TIMESTAMPTZ,
  message_sent TEXT,
  discount_offered DECIMAL(10,2),

  -- Response
  responded_at TIMESTAMPTZ,
  accepted BOOLEAN DEFAULT false,
  extended_minutes INT,

  -- Revenue Impact
  original_revenue DECIMAL(10,2),
  additional_revenue DECIMAL(10,2),
  total_revenue DECIMAL(10,2),

  -- Analytics
  trigger_reason VARCHAR(50), -- time_based, usage_based, loyalty_based
  success_score DECIMAL(3,2), -- 0.00 to 1.00

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upsell_booking ON upsell_history(booking_id);
CREATE INDEX IF NOT EXISTS idx_upsell_success ON upsell_history(accepted) WHERE accepted = true;

-- ============================================
-- 8. BOOKING CONFIGURATION
-- ============================================
CREATE TABLE IF NOT EXISTS booking_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  category VARCHAR(50), -- pricing, timing, features, display
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO booking_config (key, value, description, category) VALUES
  ('min_duration', '60', 'Minimum booking duration in minutes', 'timing'),
  ('max_duration', '360', 'Maximum booking duration in minutes', 'timing'),
  ('increment_after_first_hour', '30', 'Time increment after first hour in minutes', 'timing'),
  ('allow_cross_midnight', 'true', 'Allow bookings across midnight (11 PM - 2 AM)', 'timing'),
  ('max_advance_days_default', '14', 'Default advance booking days', 'timing'),

  ('deposit_required', 'true', 'Require deposit for bookings', 'pricing'),
  ('deposit_amount', '10.00', 'Default deposit amount', 'pricing'),
  ('free_reschedule_count', '1', 'Number of free reschedules', 'pricing'),
  ('reschedule_fee', '10.00', 'Fee for additional reschedules', 'pricing'),

  ('upsell_enabled', 'true', 'Enable smart upsell prompts', 'features'),
  ('upsell_trigger_minutes', '10', 'Minutes before end to send upsell', 'features'),
  ('upsell_trigger_rate', '0.40', 'Percentage of sessions to trigger upsell', 'features'),
  ('loyalty_reward_threshold', '10', 'Bookings needed for free hour', 'features'),
  ('auto_tier_upgrade', 'true', 'Automatically upgrade tiers based on bookings', 'features'),

  ('show_pricing', 'true', 'Show prices in booking UI', 'display'),
  ('show_photos', 'true', 'Show space photos in UI', 'display'),
  ('group_by_location', 'true', 'Group spaces by location', 'display'),
  ('show_notices', 'true', 'Show location notices', 'display')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 9. BOOKING CHANGE LOG (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS booking_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES users(id),
  change_type VARCHAR(50), -- created, rescheduled, cancelled, extended, etc
  old_values JSONB,
  new_values JSONB,
  change_reason TEXT,
  fee_charged DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_log_booking ON booking_change_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_change_log_type ON booking_change_log(change_type);

-- ============================================
-- 10. PROMO CODES & GIFT CARDS
-- ============================================
CREATE TABLE IF NOT EXISTS promo_codes (
  code VARCHAR(50) PRIMARY KEY,
  description TEXT,
  discount_type VARCHAR(20), -- percentage, fixed_amount, free_hour
  discount_value DECIMAL(10,2),
  min_booking_amount DECIMAL(10,2),
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  usage_limit INT,
  usage_count INT DEFAULT 0,
  tier_restrictions VARCHAR(50)[] DEFAULT '{}',
  location_restrictions VARCHAR(50)[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. DOOR ACCESS INTEGRATION
-- ============================================
CREATE TABLE IF NOT EXISTS booking_door_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  access_code VARCHAR(20),
  unlock_at TIMESTAMPTZ,
  lock_at TIMESTAMPTZ,
  door_controller_id VARCHAR(100), -- UniFi door ID
  access_granted BOOLEAN DEFAULT false,
  access_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_door_access_booking ON booking_door_access(booking_id);
CREATE INDEX IF NOT EXISTS idx_door_access_times ON booking_door_access(unlock_at, lock_at);

-- ============================================
-- Functions and Triggers
-- ============================================

-- Function to check booking overlaps
CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip check for admin blocks and cancelled bookings
  IF NEW.is_admin_block = true OR NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Check for overlapping bookings on the same spaces
  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id != NEW.id
    AND b.status IN ('confirmed', 'pending')
    AND b.space_ids && NEW.space_ids
    AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Booking overlaps with existing reservation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for overlap checking
DROP TRIGGER IF EXISTS check_booking_overlap_trigger ON bookings;
CREATE TRIGGER check_booking_overlap_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_booking_overlap();

-- Function to auto-update loyalty tracking
CREATE OR REPLACE FUNCTION update_loyalty_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- Update loyalty stats when booking is completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO loyalty_tracking (user_id, completed_bookings, total_spend)
    VALUES (NEW.user_id, 1, NEW.total_amount)
    ON CONFLICT (user_id) DO UPDATE SET
      completed_bookings = loyalty_tracking.completed_bookings + 1,
      total_spend = loyalty_tracking.total_spend + NEW.total_amount,
      updated_at = NOW();

    -- Check for auto tier upgrade
    UPDATE loyalty_tracking lt
    SET current_tier_id = 'member',
        previous_tier_id = lt.current_tier_id,
        last_tier_upgrade = NOW()
    FROM customer_tiers ct
    WHERE lt.user_id = NEW.user_id
    AND lt.current_tier_id = 'new'
    AND lt.completed_bookings >= COALESCE(ct.auto_upgrade_after, 999)
    AND ct.id = lt.current_tier_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for loyalty updates
DROP TRIGGER IF EXISTS update_loyalty_trigger ON bookings;
CREATE TRIGGER update_loyalty_trigger
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_loyalty_tracking();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers for all tables with updated_at
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'booking_locations', 'booking_spaces', 'location_notices',
      'loyalty_tracking', 'bookings'
    ])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%s_updated_at ON %s;
      CREATE TRIGGER update_%s_updated_at
        BEFORE UPDATE ON %s
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END $$;

-- ============================================
-- Create Views for Analytics
-- ============================================

-- View for booking analytics
CREATE OR REPLACE VIEW booking_analytics AS
SELECT
  b.location_id,
  bl.name as location_name,
  DATE(b.start_at) as booking_date,
  COUNT(*) as total_bookings,
  COUNT(DISTINCT b.user_id) as unique_users,
  AVG(b.duration_minutes) as avg_duration,
  SUM(b.total_amount) as total_revenue,
  COUNT(CASE WHEN b.upsell_accepted THEN 1 END) as upsells_accepted,
  COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancellations
FROM bookings b
JOIN booking_locations bl ON b.location_id = bl.id
WHERE b.is_admin_block = false
GROUP BY b.location_id, bl.name, DATE(b.start_at);

-- View for customer tier distribution
CREATE OR REPLACE VIEW tier_distribution AS
SELECT
  ct.id as tier_id,
  ct.name as tier_name,
  ct.color as tier_color,
  COUNT(DISTINCT lt.user_id) as user_count,
  AVG(lt.completed_bookings) as avg_bookings,
  AVG(lt.total_spend) as avg_spend
FROM customer_tiers ct
LEFT JOIN loyalty_tracking lt ON ct.id = lt.current_tier_id
GROUP BY ct.id, ct.name, ct.color;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;