-- Migration: Booking System Enhancements
-- Description: Add tables and columns for advanced booking features
-- Created: 2025-01-05

-- 1. Add booking configuration table
CREATE TABLE IF NOT EXISTS booking_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration
INSERT INTO booking_config (key, value, description) VALUES
  ('min_duration', '60', 'Minimum booking duration in minutes'),
  ('max_duration', '360', 'Maximum booking duration in minutes'),
  ('increment_after_first_hour', '30', 'Time increment after first hour in minutes'),
  ('allow_cross_midnight', 'true', 'Allow bookings that cross midnight'),
  ('max_advance_days_default', '14', 'Default advance booking days for new customers'),
  ('deposit_required', 'true', 'Whether deposit is required'),
  ('deposit_amount', '10', 'Deposit amount in dollars'),
  ('free_reschedule_count', '1', 'Number of free reschedules'),
  ('reschedule_fee', '10', 'Fee for reschedules after free ones'),
  ('upsell_enabled', 'true', 'Enable smart upselling'),
  ('upsell_trigger_minutes', '10', 'Minutes before end to trigger upsell'),
  ('upsell_trigger_rate', '0.40', 'Percentage of sessions to trigger upsell'),
  ('loyalty_reward_threshold', '10', 'Bookings needed for loyalty reward'),
  ('auto_tier_upgrade', 'true', 'Automatically upgrade customer tiers')
ON CONFLICT (key) DO NOTHING;

-- 2. Add booking changes tracking table
CREATE TABLE IF NOT EXISTS booking_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  change_type VARCHAR(50) NOT NULL, -- 'reschedule', 'cancel', 'modify'
  previous_start_at TIMESTAMP,
  previous_end_at TIMESTAMP,
  new_start_at TIMESTAMP,
  new_end_at TIMESTAMP,
  fee_charged DECIMAL(10,2) DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_booking_changes_booking ON booking_changes(booking_id);
CREATE INDEX idx_booking_changes_user ON booking_changes(user_id);

-- 3. Add booking upsells table
CREATE TABLE IF NOT EXISTS booking_upsells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  original_duration INTEGER NOT NULL,
  suggested_duration INTEGER NOT NULL,
  additional_cost DECIMAL(10,2) NOT NULL,
  discount_percent INTEGER DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  message TEXT,
  accepted BOOLEAN,
  responded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_booking_upsells_booking ON booking_upsells(booking_id);
CREATE INDEX idx_booking_upsells_user ON booking_upsells(user_id);

-- 4. Add customer tier history table
CREATE TABLE IF NOT EXISTS customer_tier_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  previous_tier_id VARCHAR(50),
  new_tier_id VARCHAR(50) NOT NULL,
  reason VARCHAR(100),
  booking_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tier_history_user ON customer_tier_history(user_id);

-- 5. Add loyalty tracking table
CREATE TABLE IF NOT EXISTS loyalty_tracking (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  total_bookings INTEGER DEFAULT 0,
  total_minutes_booked INTEGER DEFAULT 0,
  total_amount_spent DECIMAL(10,2) DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  current_tier_id VARCHAR(50) DEFAULT 'new',
  last_tier_upgrade TIMESTAMP,
  rewards_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Update bookings table with new columns
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS change_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS change_fee_charged DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS flagged_for_changes BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS upsell_scheduled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS upsell_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS upsell_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS upsell_accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS loyalty_points_earned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS promo_discount DECIMAL(10,2) DEFAULT 0;

-- 7. Update customer_tiers with new columns (if not exists)
ALTER TABLE customer_tiers
ADD COLUMN IF NOT EXISTS max_advance_days INTEGER DEFAULT 14,
ADD COLUMN IF NOT EXISTS allow_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS require_deposit BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS change_limit INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS change_fee DECIMAL(10,2) DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS auto_upgrade_after INTEGER,
ADD COLUMN IF NOT EXISTS discount_percent INTEGER DEFAULT 0;

-- Update existing tiers with proper values
UPDATE customer_tiers SET
  max_advance_days = CASE
    WHEN id = 'new' THEN 14
    WHEN id = 'member' THEN 30
    WHEN id = 'frequent' THEN 45
    WHEN id = 'promo' THEN 21
    ELSE 14
  END,
  allow_recurring = CASE
    WHEN id IN ('member', 'frequent') THEN true
    ELSE false
  END,
  require_deposit = CASE
    WHEN id = 'frequent' THEN false
    ELSE true
  END,
  change_limit = CASE
    WHEN id = 'new' THEN 1
    WHEN id = 'member' THEN 2
    WHEN id = 'frequent' THEN 3
    WHEN id = 'promo' THEN 1
    ELSE 1
  END,
  change_fee = CASE
    WHEN id = 'frequent' THEN 0
    ELSE 10.00
  END,
  auto_upgrade_after = CASE
    WHEN id = 'new' THEN 3
    WHEN id = 'member' THEN 10
    ELSE NULL
  END,
  discount_percent = CASE
    WHEN id = 'member' THEN 5
    WHEN id = 'frequent' THEN 15
    WHEN id = 'promo' THEN 10
    ELSE 0
  END
WHERE id IN ('new', 'member', 'frequent', 'promo');

-- 8. Add promo codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL, -- 'percentage' or 'fixed_amount'
  discount_value DECIMAL(10,2) NOT NULL,
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_promo_codes_code ON promo_codes(code);

-- Insert sample promo codes
INSERT INTO promo_codes (code, description, discount_type, discount_value, max_uses) VALUES
  ('FIRST10', 'First time customer - 10% off', 'percentage', 10, 1000),
  ('SUMMER25', 'Summer special - 25% off', 'percentage', 25, 100),
  ('SAVE5', 'Save $5 on any booking', 'fixed_amount', 5, 500)
ON CONFLICT (code) DO NOTHING;

-- 9. Add booking notifications table for tracking sent notifications
CREATE TABLE IF NOT EXISTS booking_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  notification_type VARCHAR(50) NOT NULL, -- 'reminder', 'upsell', 'confirmation', etc.
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP
);

CREATE INDEX idx_booking_notifications_booking ON booking_notifications(booking_id);
CREATE INDEX idx_booking_notifications_user ON booking_notifications(user_id);

-- 10. Add transactions table for payment tracking
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL, -- 'booking', 'deposit', 'reschedule_fee', 'upsell', 'refund'
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_booking ON transactions(booking_id);

-- Create function to auto-update loyalty tracking
CREATE OR REPLACE FUNCTION update_loyalty_tracking()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO loyalty_tracking (user_id, total_bookings, total_minutes_booked, total_amount_spent)
    VALUES (NEW.user_id, 1,
      EXTRACT(EPOCH FROM (NEW.end_at - NEW.start_at))/60,
      NEW.total_amount)
    ON CONFLICT (user_id) DO UPDATE SET
      total_bookings = loyalty_tracking.total_bookings + 1,
      total_minutes_booked = loyalty_tracking.total_minutes_booked + EXTRACT(EPOCH FROM (NEW.end_at - NEW.start_at))/60,
      total_amount_spent = loyalty_tracking.total_amount_spent + NEW.total_amount,
      updated_at = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for loyalty tracking
DROP TRIGGER IF EXISTS trigger_update_loyalty ON bookings;
CREATE TRIGGER trigger_update_loyalty
AFTER UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_loyalty_tracking();