-- Migration 355: Safety Trigger Analytics
-- Purpose: Track which safety features are actually triggering to inform refactoring decisions
-- Created: 2026-01-08 (v1.25.42)

-- Create analytics table for safety triggers
CREATE TABLE IF NOT EXISTS safety_trigger_analytics (
    id SERIAL PRIMARY KEY,
    trigger_type VARCHAR(50) NOT NULL,  -- 'master_kill_switch', 'global_cooldown', 'topic_lockout', 'legacy_lock', 'ai_response_limit', 'rapid_messages', 'negative_sentiment', 'test_bypass'
    phone_number VARCHAR(20),
    conversation_id INTEGER,
    trigger_details JSONB DEFAULT '{}',  -- Additional context about the trigger
    action_taken VARCHAR(50) NOT NULL,   -- 'blocked', 'escalated', 'allowed', 'bypassed'
    message_preview VARCHAR(100),        -- First 100 chars of message (for debugging)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying by trigger type and date range
CREATE INDEX IF NOT EXISTS idx_safety_analytics_type_date
ON safety_trigger_analytics(trigger_type, created_at DESC);

-- Index for querying by phone number
CREATE INDEX IF NOT EXISTS idx_safety_analytics_phone
ON safety_trigger_analytics(phone_number, created_at DESC);

-- Index for time-based cleanup queries
CREATE INDEX IF NOT EXISTS idx_safety_analytics_created
ON safety_trigger_analytics(created_at DESC);

-- Add comment explaining purpose
COMMENT ON TABLE safety_trigger_analytics IS 'Tracks V3-PLS safety feature triggers for analytics and refactoring decisions. Data retention: 30 days recommended.';

-- View for daily summary (useful for dashboards)
CREATE OR REPLACE VIEW safety_trigger_daily_summary AS
SELECT
    DATE(created_at) as date,
    trigger_type,
    action_taken,
    COUNT(*) as trigger_count
FROM safety_trigger_analytics
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), trigger_type, action_taken
ORDER BY date DESC, trigger_count DESC;

-- View for hourly breakdown (useful for identifying patterns)
CREATE OR REPLACE VIEW safety_trigger_hourly AS
SELECT
    DATE_TRUNC('hour', created_at) as hour,
    trigger_type,
    COUNT(*) as trigger_count
FROM safety_trigger_analytics
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at), trigger_type
ORDER BY hour DESC;
