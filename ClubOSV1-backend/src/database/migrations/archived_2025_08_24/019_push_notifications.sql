-- Migration: Add push notification support
-- Version: 019
-- Description: Creates tables for managing web push notifications

-- Push subscription storage
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  failed_attempts INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, endpoint)
);

-- Notification log for debugging and analytics
CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL, -- 'message', 'ticket', 'system'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'clicked'
  error TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  clicked_at TIMESTAMP
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  messages_enabled BOOLEAN DEFAULT true,
  tickets_enabled BOOLEAN DEFAULT true,
  system_enabled BOOLEAN DEFAULT true,
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_push_subs_user_active ON push_subscriptions(user_id, is_active);
CREATE INDEX idx_push_subs_endpoint ON push_subscriptions(endpoint);
CREATE INDEX idx_notification_history_user_date ON notification_history(user_id, sent_at);
CREATE INDEX idx_notification_history_status ON notification_history(status, sent_at);

-- Add migration record
INSERT INTO migrations (version, name, applied_at) 
VALUES (19, 'push_notifications', NOW()) 
ON CONFLICT (version) DO NOTHING;