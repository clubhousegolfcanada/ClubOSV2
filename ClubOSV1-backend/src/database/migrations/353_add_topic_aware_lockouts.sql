-- Migration: 353_add_topic_aware_lockouts.sql
-- Description: Add topic-aware lockout columns and configuration
-- Version: v1.25.38
-- Date: 2026-01-02

-- Add topic tracking columns to openphone_conversations
ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS last_operator_topic VARCHAR(50),
ADD COLUMN IF NOT EXISTS topic_lockout_until TIMESTAMP,
ADD COLUMN IF NOT EXISTS global_cooldown_until TIMESTAMP;

-- Add new configuration keys for topic-aware lockouts
INSERT INTO pattern_learning_config (config_key, config_value, description) VALUES
('global_cooldown_minutes', '60', 'Minutes of global AI cooldown after operator responds (before topic-specific checks)'),
('topic_lockout_enabled', 'true', 'Enable topic-aware lockouts (vs blanket lockout)')
ON CONFLICT (config_key) DO NOTHING;

-- Add comment for documentation
COMMENT ON COLUMN openphone_conversations.last_operator_topic IS 'Topic category of the last message operator responded to';
COMMENT ON COLUMN openphone_conversations.topic_lockout_until IS 'Timestamp until which AI should not respond to the same topic';
COMMENT ON COLUMN openphone_conversations.global_cooldown_until IS 'Timestamp until which AI should not respond at all (short cooldown after operator)';
