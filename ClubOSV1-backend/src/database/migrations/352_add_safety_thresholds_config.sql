-- Migration: Add configurable safety thresholds to V3-PLS system
-- Version: 1.25.37
-- This makes previously hardcoded safety settings configurable through the UI

-- Rapid message detection settings
INSERT INTO pattern_learning_config (config_key, config_value, description) VALUES
('rapid_message_threshold', '3', 'Number of customer messages in time window to trigger escalation (default: 3)'),
('rapid_message_window_seconds', '60', 'Time window in seconds for rapid message detection (default: 60)'),
('rapid_message_enabled', 'true', 'Enable/disable rapid message detection')
ON CONFLICT (config_key) DO NOTHING;

-- AI response limit settings
INSERT INTO pattern_learning_config (config_key, config_value, description) VALUES
('ai_response_limit', '3', 'Maximum AI responses per conversation before escalating to human (default: 3)'),
('ai_response_limit_enabled', 'true', 'Enable/disable AI response limit')
ON CONFLICT (config_key) DO NOTHING;

-- Operator lockout duration
INSERT INTO pattern_learning_config (config_key, config_value, description) VALUES
('operator_lockout_hours', '4', 'Hours to lock conversation after operator responds (default: 4)')
ON CONFLICT (config_key) DO NOTHING;

-- Customizable escalation message
INSERT INTO pattern_learning_config (config_key, config_value, description) VALUES
('escalation_message', 'I see you''re still having trouble. Let me connect you with one of our team members who can help you directly. Someone will be with you shortly.

- ClubAI', 'Message sent when escalating to human operator')
ON CONFLICT (config_key) DO NOTHING;

-- Negative sentiment detection settings
INSERT INTO pattern_learning_config (config_key, config_value, description) VALUES
('negative_sentiment_enabled', 'true', 'Enable/disable automatic negative sentiment detection')
ON CONFLICT (config_key) DO NOTHING;

-- Negative sentiment patterns stored as JSON array
-- Format: [{"pattern": "regex pattern", "severity": "low|medium|high|critical"}]
INSERT INTO pattern_learning_config (config_key, config_value, description) VALUES
('negative_sentiment_patterns', '[
  {"pattern": "still\\\\s+(broken|not\\\\s+working|doesn''t\\\\s+work)", "severity": "high"},
  {"pattern": "doesn''t\\\\s+help", "severity": "high"},
  {"pattern": "(frustrated|annoyed|angry|terrible|ridiculous)", "severity": "high"},
  {"pattern": "(real\\\\s+person|human|operator\\\\s+please|speak\\\\s+to\\\\s+someone)", "severity": "medium"},
  {"pattern": "waste\\\\s+of\\\\s+time", "severity": "critical"},
  {"pattern": "not\\\\s+helpful", "severity": "medium"},
  {"pattern": "this\\\\s+is\\\\s+(stupid|dumb|useless)", "severity": "high"},
  {"pattern": "still\\\\s+(confused|don''t\\\\s+understand)", "severity": "medium"}
]', 'JSON array of negative sentiment patterns with severity levels')
ON CONFLICT (config_key) DO NOTHING;

-- Rapid message escalation message (separate from main escalation)
INSERT INTO pattern_learning_config (config_key, config_value, description) VALUES
('rapid_message_escalation_text', 'I notice you''ve sent multiple messages. Let me connect you with a human operator who can better assist you.

Our team will respond shortly.

- ClubAI', 'Message sent when rapid message escalation is triggered')
ON CONFLICT (config_key) DO NOTHING;

-- AI response limit escalation message
INSERT INTO pattern_learning_config (config_key, config_value, description) VALUES
('ai_limit_escalation_text', 'I understand you need more help than I can provide. I''m connecting you with a human operator who will assist you shortly.

A member of our team will respond as soon as possible.

- ClubAI', 'Message sent when AI response limit is reached')
ON CONFLICT (config_key) DO NOTHING;

-- Negative sentiment escalation message
INSERT INTO pattern_learning_config (config_key, config_value, description) VALUES
('sentiment_escalation_text', 'I understand you need more help than I can provide. I''m connecting you with a human operator who will assist you shortly.

A member of our team will respond as soon as possible.

- ClubAI', 'Message sent when negative sentiment is detected')
ON CONFLICT (config_key) DO NOTHING;

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 352: Added configurable safety thresholds to V3-PLS system';
END $$;
