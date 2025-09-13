-- Migration: Add V3-PLS Safeguards for operator tracking and conversation management
-- Author: Claude
-- Date: 2025-09-13
-- Purpose: Add operator activity tracking to prevent AI interference during human support

-- ============================================
-- ENHANCE EXISTING TABLES
-- ============================================

-- Add operator tracking columns to openphone_conversations
ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS operator_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS operator_last_message TIMESTAMP,
ADD COLUMN IF NOT EXISTS ai_last_message TIMESTAMP,
ADD COLUMN IF NOT EXISTS conversation_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMP,
ADD COLUMN IF NOT EXISTS rapid_message_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_sentiment VARCHAR(20) DEFAULT 'neutral' CHECK (customer_sentiment IN ('positive', 'neutral', 'negative', 'escalated')),
ADD COLUMN IF NOT EXISTS ai_response_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_ai_signature VARCHAR(10);

-- Add index for quick operator activity lookups
CREATE INDEX IF NOT EXISTS idx_openphone_operator_active
ON openphone_conversations(phone_number, operator_active)
WHERE operator_active = TRUE;

-- Add index for locked conversations
CREATE INDEX IF NOT EXISTS idx_openphone_locked
ON openphone_conversations(phone_number, conversation_locked)
WHERE conversation_locked = TRUE;

-- ============================================
-- OPERATOR ACTIVITY TRACKING TABLE
-- ============================================

-- Track operator interventions for analytics
CREATE TABLE IF NOT EXISTS operator_interventions (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(50) NOT NULL,
  conversation_id VARCHAR(255),
  operator_id INTEGER REFERENCES users(id),
  intervention_type VARCHAR(50) DEFAULT 'manual_response', -- 'manual_response', 'takeover', 'correction'
  ai_was_active BOOLEAN DEFAULT FALSE,
  message_sent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Metrics
  messages_before_intervention INTEGER DEFAULT 0,
  ai_responses_before_intervention INTEGER DEFAULT 0,
  customer_sentiment_before VARCHAR(20),
  customer_sentiment_after VARCHAR(20),

  -- Index for reporting
  INDEX idx_intervention_date (created_at DESC),
  INDEX idx_intervention_operator (operator_id),
  INDEX idx_intervention_type (intervention_type)
);

-- ============================================
-- CONVERSATION STATE TRACKING
-- ============================================

-- Track conversation states for better boundary detection
CREATE TABLE IF NOT EXISTS conversation_states (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(50) NOT NULL,
  conversation_id VARCHAR(255) UNIQUE,

  -- State tracking
  state VARCHAR(50) DEFAULT 'idle', -- 'idle', 'ai_handling', 'operator_handling', 'escalated', 'completed'
  topic VARCHAR(50), -- 'booking', 'tech_support', 'access', 'general', 'complaint'

  -- Timing
  conversation_started TIMESTAMP DEFAULT NOW(),
  conversation_ended TIMESTAMP,
  expected_duration_minutes INTEGER DEFAULT 60,

  -- Activity tracking
  last_customer_message TIMESTAMP,
  last_operator_message TIMESTAMP,
  last_ai_message TIMESTAMP,

  -- Metrics
  total_messages INTEGER DEFAULT 0,
  customer_messages INTEGER DEFAULT 0,
  operator_messages INTEGER DEFAULT 0,
  ai_messages INTEGER DEFAULT 0,

  -- Sentiment tracking
  sentiment_history JSONB DEFAULT '[]', -- Array of {timestamp, sentiment, message_snippet}
  escalation_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  INDEX idx_state_phone (phone_number, state),
  INDEX idx_state_updated (updated_at DESC)
);

-- ============================================
-- NEGATIVE SENTIMENT PATTERNS
-- ============================================

-- Store patterns that indicate negative sentiment
CREATE TABLE IF NOT EXISTS negative_sentiment_patterns (
  id SERIAL PRIMARY KEY,
  pattern TEXT NOT NULL UNIQUE,
  pattern_type VARCHAR(50) DEFAULT 'keyword', -- 'keyword', 'regex', 'phrase'
  severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  auto_escalate BOOLEAN DEFAULT FALSE,
  escalation_message TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default negative sentiment patterns
INSERT INTO negative_sentiment_patterns (pattern, pattern_type, severity, auto_escalate, escalation_message) VALUES
('still broken', 'phrase', 'high', true, 'I understand you''re still experiencing issues. Let me connect you with a human operator who can help resolve this immediately.\n\n- ClubAI'),
('still not working', 'phrase', 'high', true, 'I understand the problem persists. Let me get a human operator to assist you right away.\n\n- ClubAI'),
('doesn''t help', 'phrase', 'high', true, 'I apologize that my response wasn''t helpful. Let me connect you with our team for better assistance.\n\n- ClubAI'),
('frustrated', 'keyword', 'high', true, 'I understand your frustration. A member of our team will help you shortly.\n\n- ClubAI'),
('annoyed', 'keyword', 'medium', true, 'I apologize for the inconvenience. Let me get someone from our team to help you.\n\n- ClubAI'),
('angry', 'keyword', 'critical', true, 'I understand you''re upset. Our team will assist you immediately.\n\n- ClubAI'),
('terrible', 'keyword', 'high', true, 'I''m sorry for this poor experience. Our team will help resolve this right away.\n\n- ClubAI'),
('speak to human', 'phrase', 'medium', true, 'Connecting you with a human operator now.\n\n- ClubAI'),
('real person', 'phrase', 'medium', true, 'I''ll connect you with a team member right away.\n\n- ClubAI'),
('operator please', 'phrase', 'medium', true, 'Connecting you with an operator now.\n\n- ClubAI'),
('this is ridiculous', 'phrase', 'critical', true, 'I sincerely apologize. Our team will address this immediately.\n\n- ClubAI'),
('waste of time', 'phrase', 'high', true, 'I apologize for the frustration. Let me get our team to help you properly.\n\n- ClubAI'),
('not helpful', 'phrase', 'medium', true, 'I''m sorry I couldn''t be more helpful. Let me connect you with our team.\n\n- ClubAI')
ON CONFLICT (pattern) DO NOTHING;

-- ============================================
-- CONFIGURATION UPDATES
-- ============================================

-- Add safeguard configurations
INSERT INTO pattern_learning_config (config_key, config_value, description) VALUES
('include_clubai_signature', 'true', 'Add "- ClubAI" signature to all AI responses'),
('operator_lockout_hours', '4', 'Hours to disable AI after operator takes over'),
('rapid_message_threshold', '3', 'Number of messages in 60 seconds to trigger escalation'),
('rapid_message_window_seconds', '60', 'Time window for rapid message detection'),
('negative_sentiment_auto_escalate', 'true', 'Automatically escalate on negative sentiment'),
('max_ai_responses_per_conversation', '3', 'Maximum AI responses before requiring operator'),
('conversation_window_booking_hours', '4', 'Conversation window for booking-related messages'),
('conversation_window_support_hours', '2', 'Conversation window for technical support messages'),
('conversation_window_general_hours', '1', 'Default conversation window for general messages')
ON CONFLICT (config_key) DO UPDATE
SET config_value = EXCLUDED.config_value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if operator is currently active
CREATE OR REPLACE FUNCTION is_operator_active(p_phone_number VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  v_active BOOLEAN;
  v_lockout_hours INTEGER;
BEGIN
  -- Get lockout configuration
  SELECT COALESCE(config_value::INTEGER, 4) INTO v_lockout_hours
  FROM pattern_learning_config
  WHERE config_key = 'operator_lockout_hours';

  -- Check if operator is active within lockout window
  SELECT EXISTS(
    SELECT 1 FROM openphone_conversations
    WHERE phone_number = p_phone_number
    AND (
      conversation_locked = TRUE
      OR (operator_active = TRUE AND operator_last_message > NOW() - (v_lockout_hours || ' hours')::INTERVAL)
      OR lockout_until > NOW()
    )
  ) INTO v_active;

  RETURN v_active;
END;
$$ LANGUAGE plpgsql;

-- Function to detect rapid messages
CREATE OR REPLACE FUNCTION detect_rapid_messages(p_phone_number VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  v_message_count INTEGER;
  v_window_seconds INTEGER;
BEGIN
  -- Get configuration
  SELECT COALESCE(config_value::INTEGER, 60) INTO v_window_seconds
  FROM pattern_learning_config
  WHERE config_key = 'rapid_message_window_seconds';

  -- Count recent messages
  SELECT COUNT(*) INTO v_message_count
  FROM openphone_conversations oc
  WHERE oc.phone_number = p_phone_number
  AND oc.messages IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(oc.messages) AS msg
    WHERE (msg->>'createdAt')::TIMESTAMP > NOW() - (v_window_seconds || ' seconds')::INTERVAL
  );

  RETURN v_message_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get conversation window based on topic
CREATE OR REPLACE FUNCTION get_conversation_window(p_message TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_window_minutes INTEGER;
BEGIN
  -- Check for booking patterns
  IF p_message ~* 'book|reservation|tee time|schedule|appointment' THEN
    SELECT COALESCE(config_value::INTEGER * 60, 240) INTO v_window_minutes
    FROM pattern_learning_config
    WHERE config_key = 'conversation_window_booking_hours';

  -- Check for technical support patterns
  ELSIF p_message ~* 'broken|stuck|frozen|not working|issue|problem|help' THEN
    SELECT COALESCE(config_value::INTEGER * 60, 120) INTO v_window_minutes
    FROM pattern_learning_config
    WHERE config_key = 'conversation_window_support_hours';

  -- Default to general window
  ELSE
    SELECT COALESCE(config_value::INTEGER * 60, 60) INTO v_window_minutes
    FROM pattern_learning_config
    WHERE config_key = 'conversation_window_general_hours';
  END IF;

  RETURN v_window_minutes;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_openphone_conv_phone_updated
ON openphone_conversations(phone_number, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_states_active
ON conversation_states(state, updated_at DESC)
WHERE state IN ('ai_handling', 'operator_handling', 'escalated');

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'V3-PLS Safeguards migration completed successfully';
  RAISE NOTICE 'Added operator tracking, sentiment detection, and conversation management';
  RAISE NOTICE 'Run tests to verify: npm run test:safeguards';
END $$;