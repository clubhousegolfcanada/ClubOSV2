-- Migration: Transfer AI Automation patterns to V3-PLS decision_patterns
-- Date: 2025-10-01
-- Purpose: Unify pattern management under V3-PLS system with manual control

-- ============================================
-- STEP 1: Configure Pattern Learning System
-- ============================================

-- Create pattern learning configuration table if it doesn't exist
CREATE TABLE IF NOT EXISTS pattern_learning_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert configuration for suggestion-only mode
INSERT INTO pattern_learning_config (config_key, config_value, description)
VALUES
  ('enabled', 'true', 'Enable pattern learning system'),
  ('shadow_mode', 'false', 'Disable shadow mode to allow suggestions'),
  ('auto_execute_threshold', '0.99', 'Very high threshold - effectively disables auto-execution'),
  ('suggest_threshold', '0.50', 'Lower threshold to capture more patterns for review'),
  ('queue_threshold', '0.30', 'Even lower threshold for learning'),
  ('min_confidence_to_act', '0.99', 'Minimum confidence required for auto-execution'),
  ('confidence_increase_success', '0.10', 'Confidence increase on successful execution'),
  ('confidence_decrease_failure', '0.20', 'Confidence decrease on failure'),
  ('min_executions_for_auto', '10', 'Minimum successful executions before auto-executable')
ON CONFLICT (config_key) DO UPDATE
SET config_value = EXCLUDED.config_value,
    updated_at = NOW();

-- ============================================
-- STEP 2: Migrate Existing Patterns
-- ============================================

-- Gift Card Pattern (proven and working)
INSERT INTO decision_patterns (
  pattern_type,
  pattern_signature,
  trigger_text,
  trigger_keywords,
  response_template,
  confidence_score,
  is_active,
  auto_executable,
  execution_count,
  success_count,
  created_from,
  notes
) VALUES (
  'gift_cards',
  MD5('gift card purchase inquiry'),
  'How can I buy a gift card?',
  ARRAY['gift card', 'gift cards', 'gift certificate', 'purchase gift', 'buy gift', 'gift voucher', 'where gift', 'how gift'],
  'You can purchase gift cards online at www.clubhouse247golf.com/giftcard/purchase. We offer both digital and physical gift cards in various denominations from $25 to $500. Digital cards are delivered instantly via email, while physical cards can be picked up at any of our locations or shipped to you.

- ClubAI',
  0.90, -- High confidence as this is proven
  false, -- NOT active - operator must enable
  false, -- NOT auto-executable until manually approved
  0, -- Reset execution count
  0, -- Reset success count
  'migrated',
  'Migrated from AI Automation Service - proven pattern for gift card inquiries'
) ON CONFLICT (pattern_signature) DO UPDATE
SET
  trigger_keywords = EXCLUDED.trigger_keywords,
  response_template = EXCLUDED.response_template,
  is_active = true,
  notes = EXCLUDED.notes;

-- Trackman Reset Pattern (requires confirmation)
INSERT INTO decision_patterns (
  pattern_type,
  pattern_signature,
  trigger_text,
  trigger_keywords,
  response_template,
  confidence_score,
  is_active,
  auto_executable,
  execution_count,
  success_count,
  created_from,
  notes
) VALUES (
  'tech_issue',
  MD5('trackman frozen reset'),
  'The trackman is frozen',
  ARRAY['trackman frozen', 'screen frozen', 'simulator stuck', 'not detecting', 'not tracking', 'balls not', 'frozen screen', 'stuck simulator', 'trackman issue'],
  'I see you''re experiencing issues with the Trackman system. If you signed in to your Trackman account before starting, I can reset the system quickly and you can pick back up through the "My Activities" button.

Would you like me to reset it for you? Just reply "yes" and I''ll take care of it right away.

- ClubAI',
  0.85, -- Good confidence
  false, -- NOT active - operator must enable
  false, -- NOT auto-executable - requires confirmation
  0,
  0,
  'migrated',
  'Migrated from AI Automation Service - Trackman reset with confirmation'
) ON CONFLICT (pattern_signature) DO UPDATE
SET
  trigger_keywords = EXCLUDED.trigger_keywords,
  response_template = EXCLUDED.response_template,
  is_active = true,
  notes = EXCLUDED.notes;

-- Booking Change Pattern
INSERT INTO decision_patterns (
  pattern_type,
  pattern_signature,
  trigger_text,
  trigger_keywords,
  response_template,
  confidence_score,
  is_active,
  auto_executable,
  execution_count,
  success_count,
  created_from,
  notes
) VALUES (
  'booking',
  MD5('booking change request'),
  'Can I change my booking?',
  ARRAY['change booking', 'modify booking', 'reschedule', 'move booking', 'different time', 'change reservation', 'update booking', 'switch time'],
  'To change your booking, please log into your Skedda account at skedda.com or use the Skedda mobile app. You can modify or cancel your booking up to 1 hour before your scheduled time.

If you need immediate assistance or have issues with Skedda, please call us at your location''s direct line and our staff will help you.

- ClubAI',
  0.80,
  false, -- NOT active - operator must enable
  false, -- NOT auto-executable initially
  0,
  0,
  'migrated',
  'Migrated from AI Automation Service - Booking change instructions'
) ON CONFLICT (pattern_signature) DO UPDATE
SET
  trigger_keywords = EXCLUDED.trigger_keywords,
  response_template = EXCLUDED.response_template,
  is_active = true,
  notes = EXCLUDED.notes;

-- Rapid Message Escalation (built-in safeguard)
INSERT INTO decision_patterns (
  pattern_type,
  pattern_signature,
  trigger_text,
  trigger_keywords,
  response_template,
  confidence_score,
  is_active,
  auto_executable,
  execution_count,
  success_count,
  created_from,
  notes
) VALUES (
  'escalation',
  MD5('rapid messages escalation'),
  'Multiple messages in short time',
  ARRAY['SYSTEM_RAPID_MESSAGES'],
  'I notice you''ve sent multiple messages. Let me connect you with a human operator who can better assist you.

Our team will respond shortly.

- ClubAI',
  1.00, -- Always escalate rapid messages
  true, -- ACTIVE - this is a safety feature
  true, -- AUTO-EXECUTE - this is a safety feature
  0,
  0,
  'system',
  'System safeguard for rapid message detection - auto-escalates to human'
) ON CONFLICT (pattern_signature) DO UPDATE
SET
  is_active = true,
  auto_executable = true,
  notes = EXCLUDED.notes;

-- ============================================
-- STEP 3: Create Helper Functions
-- ============================================

-- Function to check if a pattern should auto-execute
CREATE OR REPLACE FUNCTION should_pattern_auto_execute(pattern_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  pattern RECORD;
BEGIN
  SELECT * INTO pattern
  FROM decision_patterns
  WHERE id = pattern_id;

  -- Pattern must be active AND auto_executable AND have high confidence
  RETURN pattern.is_active
    AND pattern.auto_executable
    AND pattern.confidence_score >= 0.85
    AND pattern.execution_count >= 5
    AND (pattern.success_count::float / NULLIF(pattern.execution_count, 0)) >= 0.8;
END;
$$ LANGUAGE plpgsql;

-- Function to promote pattern to auto-executable
CREATE OR REPLACE FUNCTION promote_pattern_to_auto(pattern_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  pattern RECORD;
BEGIN
  SELECT * INTO pattern
  FROM decision_patterns
  WHERE id = pattern_id;

  -- Check if pattern meets criteria
  IF pattern.confidence_score >= 0.85
    AND pattern.execution_count >= 10
    AND (pattern.success_count::float / NULLIF(pattern.execution_count, 0)) >= 0.9
  THEN
    UPDATE decision_patterns
    SET auto_executable = true,
        notes = notes || ' | Promoted to auto-executable on ' || NOW()::date
    WHERE id = pattern_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 4: Create Pattern Suggestion Queue (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS pattern_suggestions_queue (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR(255),
  approved_pattern_id INTEGER REFERENCES decision_patterns(id),
  pattern_type VARCHAR(50),
  trigger_text TEXT,
  suggested_response TEXT,
  confidence_score DECIMAL(3,2),
  reasoning JSONB,
  phone_number VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  operator_id INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON pattern_suggestions_queue(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_conversation ON pattern_suggestions_queue(conversation_id);

-- ============================================
-- STEP 5: Update Pattern Statistics
-- ============================================

-- Update execution counts for migrated patterns based on AI automation usage
UPDATE decision_patterns dp
SET
  execution_count = COALESCE(
    (SELECT COUNT(*)
     FROM ai_automation_usage au
     JOIN ai_automation_features af ON au.feature_id = af.id
     WHERE af.feature_key = dp.pattern_type
       AND au.success = true),
    0
  ),
  success_count = COALESCE(
    (SELECT COUNT(*)
     FROM ai_automation_usage au
     JOIN ai_automation_features af ON au.feature_id = af.id
     WHERE af.feature_key = dp.pattern_type
       AND au.success = true),
    0
  )
WHERE created_from = 'migrated';

-- ============================================
-- STEP 6: Add Monitoring View
-- ============================================

CREATE OR REPLACE VIEW v3_pls_pattern_status AS
SELECT
  id,
  pattern_type,
  trigger_text,
  confidence_score,
  is_active,
  auto_executable,
  execution_count,
  success_count,
  CASE
    WHEN execution_count > 0 THEN
      ROUND((success_count::numeric / execution_count) * 100, 2)
    ELSE 0
  END as success_rate,
  CASE
    WHEN auto_executable AND is_active THEN 'AUTO-EXECUTING'
    WHEN is_active AND NOT auto_executable THEN 'SUGGESTING'
    WHEN NOT is_active THEN 'DISABLED'
  END as status,
  last_used,
  created_from
FROM decision_patterns
ORDER BY confidence_score DESC;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
DECLARE
  pattern_count INTEGER;
  config_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO pattern_count FROM decision_patterns WHERE created_from IN ('migrated', 'system');
  SELECT COUNT(*) INTO config_count FROM pattern_learning_config;

  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  - Patterns migrated: %', pattern_count;
  RAISE NOTICE '  - Config settings: %', config_count;
  RAISE NOTICE '  - All patterns set to suggestion mode (auto_executable = false except escalation)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Test patterns in suggestion mode';
  RAISE NOTICE '  2. Review suggested responses in queue';
  RAISE NOTICE '  3. Manually promote patterns to auto-executable when ready';
END $$;