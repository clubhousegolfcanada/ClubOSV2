-- Migration: 341_booking_audit_and_notifications.sql
-- Purpose: Add audit logging and scheduled notifications for bookings
-- Author: ClubOS Migration System
-- Date: 2025-10-26
-- Description: Creates tables for tracking booking changes and managing notifications

BEGIN;

-- ============================================
-- 1. CREATE BOOKING AUDIT TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS booking_audit (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for performance
  INDEX idx_booking_audit_booking_id (booking_id),
  INDEX idx_booking_audit_user_id (user_id),
  INDEX idx_booking_audit_action (action),
  INDEX idx_booking_audit_created_at (created_at)
);

-- Add comment
COMMENT ON TABLE booking_audit IS 'Audit log for all booking changes including creation, updates, and cancellations';

-- ============================================
-- 2. CREATE SCHEDULED NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- reminder, feedback, follow_up
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(50),
  template_data JSONB,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed, cancelled
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
  attempts INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for performance
  INDEX idx_scheduled_notifications_booking_id (booking_id),
  INDEX idx_scheduled_notifications_status (status),
  INDEX idx_scheduled_notifications_scheduled_for (scheduled_for),
  INDEX idx_scheduled_notifications_type (type)
);

-- Add comment
COMMENT ON TABLE scheduled_notifications IS 'Queue for scheduled booking notifications like reminders and follow-ups';

-- ============================================
-- 3. CREATE NOTIFICATION TEMPLATES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS notification_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL, -- email, sms, push
  subject VARCHAR(255),
  body_html TEXT,
  body_text TEXT,
  variables JSONB, -- List of available template variables
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add default templates
INSERT INTO notification_templates (name, type, subject, body_text, variables) VALUES
('booking_confirmation', 'email', 'Booking Confirmation - Clubhouse 24/7',
 'Your booking is confirmed for {{date}} at {{time}}. Booking ID: {{bookingId}}',
 '["customerName", "date", "time", "location", "space", "bookingId", "amount"]'::jsonb),

('booking_reminder', 'email', 'Reminder: Your booking is tomorrow',
 'Hi {{customerName}}, this is a reminder about your booking tomorrow at {{time}}.',
 '["customerName", "date", "time", "location", "space"]'::jsonb),

('booking_cancellation', 'email', 'Booking Cancelled',
 'Your booking {{bookingId}} has been cancelled. {{refundInfo}}',
 '["customerName", "bookingId", "refundInfo", "reason"]'::jsonb),

('booking_confirmation_sms', 'sms', NULL,
 'Clubhouse 24/7: Booking confirmed for {{date}} at {{time}}. ID: {{bookingId}}',
 '["date", "time", "bookingId", "space"]'::jsonb),

('booking_reminder_sms', 'sms', NULL,
 'Reminder: Your Clubhouse 24/7 booking is tomorrow at {{time}}',
 '["time", "space"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 4. CREATE AUDIT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION audit_booking_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id INTEGER;
  v_action VARCHAR(50);
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  -- Get the user ID from the current session if available
  v_user_id := current_setting('app.current_user_id', true)::INTEGER;

  -- Determine the action
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine specific update type
    IF OLD.status != NEW.status THEN
      IF NEW.status = 'cancelled' THEN
        v_action := 'cancel';
      ELSIF NEW.status = 'completed' THEN
        v_action := 'complete';
      ELSIF NEW.status = 'no-show' THEN
        v_action := 'no_show';
      ELSE
        v_action := 'update_status';
      END IF;
    ELSIF OLD.start_at != NEW.start_at OR OLD.end_at != NEW.end_at THEN
      v_action := 'change_time';
    ELSIF OLD.space_ids != NEW.space_ids THEN
      v_action := 'change_space';
    ELSE
      v_action := 'update';
    END IF;

    -- Store only changed fields
    v_old_values := jsonb_build_object(
      'status', OLD.status,
      'start_at', OLD.start_at,
      'end_at', OLD.end_at,
      'space_ids', OLD.space_ids,
      'total_amount', OLD.total_amount
    );
    v_new_values := jsonb_build_object(
      'status', NEW.status,
      'start_at', NEW.start_at,
      'end_at', NEW.end_at,
      'space_ids', NEW.space_ids,
      'total_amount', NEW.total_amount
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
  END IF;

  -- Insert audit record
  INSERT INTO booking_audit (
    booking_id,
    user_id,
    action,
    old_values,
    new_values,
    created_at
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    v_user_id,
    v_action,
    v_old_values,
    v_new_values,
    CURRENT_TIMESTAMP
  );

  -- Return the appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. ATTACH AUDIT TRIGGER TO BOOKINGS TABLE
-- ============================================

DROP TRIGGER IF EXISTS booking_audit_trigger ON bookings;
CREATE TRIGGER booking_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW EXECUTE FUNCTION audit_booking_changes();

-- ============================================
-- 6. CREATE FUNCTION TO SCHEDULE REMINDERS
-- ============================================

CREATE OR REPLACE FUNCTION schedule_booking_reminder(
  p_booking_id INTEGER,
  p_reminder_hours INTEGER DEFAULT 24
)
RETURNS void AS $$
DECLARE
  v_booking RECORD;
  v_reminder_time TIMESTAMPTZ;
BEGIN
  -- Get booking details
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id;
  END IF;

  -- Calculate reminder time
  v_reminder_time := v_booking.start_at - (p_reminder_hours || ' hours')::INTERVAL;

  -- Only schedule if reminder time is in the future
  IF v_reminder_time > CURRENT_TIMESTAMP THEN
    INSERT INTO scheduled_notifications (
      booking_id,
      type,
      recipient_email,
      recipient_phone,
      scheduled_for,
      template_data,
      priority
    ) VALUES (
      p_booking_id,
      'reminder',
      v_booking.customer_email,
      v_booking.customer_phone,
      v_reminder_time,
      jsonb_build_object(
        'customerName', v_booking.customer_name,
        'startTime', v_booking.start_at,
        'endTime', v_booking.end_at,
        'spaceIds', v_booking.space_ids
      ),
      CASE
        WHEN v_booking.total_amount > 200 THEN 'high'
        ELSE 'normal'
      END
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. CREATE VIEW FOR BOOKING HISTORY
-- ============================================

CREATE OR REPLACE VIEW booking_history AS
SELECT
  ba.id,
  ba.booking_id,
  b.customer_name,
  b.customer_email,
  u.name as modified_by,
  ba.action,
  ba.old_values,
  ba.new_values,
  ba.reason,
  ba.created_at
FROM booking_audit ba
LEFT JOIN bookings b ON ba.booking_id = b.id
LEFT JOIN users u ON ba.user_id = u.id
ORDER BY ba.created_at DESC;

-- Grant permissions
GRANT SELECT ON booking_history TO authenticated;

-- ============================================
-- 8. CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bookings_date_location_status
ON bookings(start_at, location_id, status)
WHERE status IN ('confirmed', 'pending');

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_pending
ON scheduled_notifications(scheduled_for, status)
WHERE status = 'pending';

-- ============================================
-- 9. ADD NOTIFICATION PREFERENCES TO USERS
-- ============================================

-- Add notification preferences column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'notification_preferences'
  ) THEN
    ALTER TABLE users ADD COLUMN notification_preferences JSONB DEFAULT '{
      "booking_confirmations": true,
      "booking_reminders": true,
      "booking_alerts": true,
      "marketing": false
    }'::jsonb;
  END IF;
END $$;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify tables were created
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_name IN ('booking_audit', 'scheduled_notifications', 'notification_templates')
ORDER BY table_name;

-- Verify trigger exists
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'booking_audit_trigger';

-- Show notification templates
SELECT name, type, subject FROM notification_templates ORDER BY name;