-- Migration: 301_booking_system_part3.sql
-- Description: Booking System Part 3 - Customer Tiers, Change Management, and Enhanced Bookings
-- Created: 2025-10-05
-- Author: ClubOS Development Team

-- ============================================
-- UP MIGRATION
-- ============================================

-- Customer tiers and tags
CREATE TABLE IF NOT EXISTS customer_tiers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL,  -- Hex color for calendar
  hourly_rate DECIMAL(10,2),
  discount_percent INT,
  max_advance_days INT,
  allow_recurring BOOLEAN DEFAULT false,
  require_deposit BOOLEAN DEFAULT true,
  change_limit INT DEFAULT 1, -- Number of free changes allowed
  change_fee DECIMAL(10,2) DEFAULT 10.00,
  auto_upgrade_after INT,  -- Bookings count for auto-upgrade
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default tiers
INSERT INTO customer_tiers (id, name, color, hourly_rate, max_advance_days, allow_recurring, auto_upgrade_after) VALUES
('new', 'New Customer', '#3B82F6', 30.00, 14, false, 3),
('member', 'Standard Member', '#FCD34D', 22.50, 30, true, NULL),
('promo', 'Promo User', '#10B981', 15.00, 14, false, NULL),
('frequent', 'Frequent Booker', '#8B5CF6', 20.00, 30, true, NULL);

-- Enhanced bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(50),
  space_ids VARCHAR(50)[] NOT NULL,  -- Array for multi-simulator
  user_id UUID REFERENCES users(id),
  customer_tier_id VARCHAR(50) REFERENCES customer_tiers(id),

  -- Time fields
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_at - start_at)) / 60
  ) STORED,

  -- Pricing
  base_rate DECIMAL(10,2),
  deposit_amount DECIMAL(10,2) DEFAULT 10.00,
  deposit_paid BOOLEAN DEFAULT false,
  total_amount DECIMAL(10,2),
  promo_code VARCHAR(50),
  discount_amount DECIMAL(10,2) DEFAULT 0,

  -- Change tracking
  change_count INT DEFAULT 0,
  change_fee_charged DECIMAL(10,2) DEFAULT 0,
  flagged_for_changes BOOLEAN DEFAULT false,
  original_booking_id UUID, -- Links to original booking if this is a reschedule

  -- Status
  status VARCHAR(20) DEFAULT 'confirmed', -- confirmed, pending, cancelled, completed
  is_recurring BOOLEAN DEFAULT false,
  recurring_id UUID,  -- Links recurring bookings
  recurring_pattern JSONB, -- Stores recurring pattern details

  -- Smart features
  upsell_sent BOOLEAN DEFAULT false,
  upsell_accepted BOOLEAN DEFAULT false,
  favorite_simulator VARCHAR(50),

  -- Metadata
  crm_notes TEXT,
  admin_notes TEXT,
  block_reason VARCHAR(100),  -- For admin blocks
  booked_by UUID REFERENCES users(id), -- Who made the booking (for staff bookings)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent double bookings (updated for array)
  EXCLUDE USING gist (
    space_ids WITH &&,
    tstzrange(start_at, end_at) WITH &&
  ) WHERE (status IN ('confirmed', 'pending'))
);

-- Booking change history
CREATE TABLE IF NOT EXISTS booking_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  user_id UUID REFERENCES users(id),
  change_type VARCHAR(50), -- reschedule, cancel, modify
  previous_start_at TIMESTAMPTZ,
  previous_end_at TIMESTAMPTZ,
  new_start_at TIMESTAMPTZ,
  new_end_at TIMESTAMPTZ,
  fee_charged DECIMAL(10,2) DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promo codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_type VARCHAR(20), -- percentage, fixed
  discount_value DECIMAL(10,2),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  usage_limit INT,
  times_used INT DEFAULT 0,
  customer_tier_ids VARCHAR(50)[], -- Which tiers can use this code
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer tier tracking
CREATE TABLE IF NOT EXISTS customer_tier_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  previous_tier_id VARCHAR(50) REFERENCES customer_tiers(id),
  new_tier_id VARCHAR(50) REFERENCES customer_tiers(id),
  reason VARCHAR(100), -- auto_upgrade, admin_override, promo_applied
  booking_count INT, -- Bookings at time of change
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add booking configuration to system_settings
INSERT INTO system_settings (key, value, description, category) VALUES
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
  "depositAmount": 10,
  "changeFee": 10,
  "dynamicPricing": true,
  "allowMultiSimulator": true,
  "upsellPrompts": {
    "enabled": true,
    "triggerMinutesBefore": 10,
    "triggerProbability": 0.4,
    "discountPercent": 20,
    "messageTemplate": "Enjoying your session? Extend for another hour at 20% off!"
  },
  "loyaltyProgram": {
    "freeAfterSessions": 10,
    "surpriseRewards": true,
    "badges": true
  },
  "showPricing": true,
  "showPhotos": true,
  "groupByLocation": true,
  "showNotices": true
}'::jsonb, 'Configuration for booking system', 'booking')
ON CONFLICT (key) DO NOTHING;

-- Add customer_tier_id to users table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'customer_tier_id') THEN
    ALTER TABLE users ADD COLUMN customer_tier_id VARCHAR(50) DEFAULT 'new' REFERENCES customer_tiers(id);
  END IF;
END $$;

-- Add booking_count to users table for tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'total_bookings') THEN
    ALTER TABLE users ADD COLUMN total_bookings INT DEFAULT 0;
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_user_tier ON bookings(user_id, customer_tier_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status) WHERE status IN ('confirmed', 'pending');
CREATE INDEX IF NOT EXISTS idx_bookings_changes ON bookings(change_count) WHERE flagged_for_changes = true;
CREATE INDEX IF NOT EXISTS idx_booking_changes_booking ON booking_changes(booking_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_customer_tier_history_user ON customer_tier_history(user_id);

-- Create function to auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_customer_tiers_updated_at BEFORE UPDATE ON customer_tiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promo_codes_updated_at BEFORE UPDATE ON promo_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DOWN MIGRATION (for rollback)
-- ============================================

/*
DROP TRIGGER IF EXISTS update_promo_codes_updated_at ON promo_codes;
DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
DROP TRIGGER IF EXISTS update_customer_tiers_updated_at ON customer_tiers;
DROP FUNCTION IF EXISTS update_updated_at_column();

DROP TABLE IF EXISTS customer_tier_history CASCADE;
DROP TABLE IF EXISTS promo_codes CASCADE;
DROP TABLE IF EXISTS booking_changes CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS customer_tiers CASCADE;

ALTER TABLE users DROP COLUMN IF EXISTS customer_tier_id;
ALTER TABLE users DROP COLUMN IF EXISTS total_bookings;

DELETE FROM system_settings WHERE key = 'booking_config';
*/