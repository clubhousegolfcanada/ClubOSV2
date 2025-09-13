-- Script to enable V3-PLS in production
-- Run this after migration 220 has been applied
-- Usage: railway run psql $DATABASE_URL < scripts/enable-v3-pls-production.sql

-- ============================================
-- 1. ENABLE PATTERN LEARNING
-- ============================================

-- Enable the pattern learning system
UPDATE pattern_learning_config
SET config_value = 'true', updated_at = NOW()
WHERE config_key = 'enabled';

-- Disable shadow mode (allow actual execution)
UPDATE pattern_learning_config
SET config_value = 'false', updated_at = NOW()
WHERE config_key = 'shadow_mode';

-- Enable ClubAI signature
UPDATE pattern_learning_config
SET config_value = 'true', updated_at = NOW()
WHERE config_key = 'include_clubai_signature';

-- Set reasonable thresholds
UPDATE pattern_learning_config
SET config_value = '0.85', updated_at = NOW()
WHERE config_key = 'auto_execute_threshold';

UPDATE pattern_learning_config
SET config_value = '0.60', updated_at = NOW()
WHERE config_key = 'suggest_threshold';

UPDATE pattern_learning_config
SET config_value = '3', updated_at = NOW()
WHERE config_key = 'min_executions_for_auto';

-- ============================================
-- 2. UPDATE EXISTING PATTERNS WITH CLUBAI SIGNATURE
-- ============================================

-- Add ClubAI signature to existing patterns that don't have it
UPDATE decision_patterns
SET response_template =
  CASE
    WHEN response_template LIKE '%- ClubAI%' OR response_template LIKE '%-ClubAI%'
    THEN response_template
    ELSE response_template || E'\n\n- ClubAI'
  END,
  last_modified = NOW()
WHERE is_active = true
  AND (response_template NOT LIKE '%- ClubAI%'
       AND response_template NOT LIKE '%-ClubAI%');

-- ============================================
-- 3. VERIFY CONFIGURATION
-- ============================================

-- Show current configuration
SELECT
  config_key,
  config_value,
  description
FROM pattern_learning_config
WHERE config_key IN (
  'enabled',
  'shadow_mode',
  'include_clubai_signature',
  'auto_execute_threshold',
  'suggest_threshold',
  'min_executions_for_auto',
  'operator_lockout_hours',
  'rapid_message_threshold',
  'negative_sentiment_auto_escalate'
)
ORDER BY config_key;

-- ============================================
-- 4. CHECK ACTIVE PATTERNS
-- ============================================

-- Show active patterns with their confidence scores
SELECT
  id,
  pattern_type,
  LEFT(trigger_text, 50) as trigger_preview,
  confidence_score,
  auto_executable,
  execution_count,
  success_count,
  CASE
    WHEN response_template LIKE '%- ClubAI%' THEN 'Yes'
    ELSE 'No'
  END as has_signature
FROM decision_patterns
WHERE is_active = true
  AND (is_deleted IS NULL OR is_deleted = false)
ORDER BY confidence_score DESC;

-- ============================================
-- 5. CHECK SAFEGUARD TABLES
-- ============================================

-- Verify new tables exist
SELECT
  'operator_interventions' as table_name,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operator_interventions') as exists
UNION ALL
SELECT
  'conversation_states',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_states')
UNION ALL
SELECT
  'negative_sentiment_patterns',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'negative_sentiment_patterns');

-- Check if operator tracking columns were added
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'openphone_conversations'
  AND column_name IN (
    'operator_active',
    'operator_last_message',
    'ai_last_message',
    'conversation_locked',
    'lockout_until',
    'rapid_message_count',
    'customer_sentiment'
  );

-- ============================================
-- 6. CHECK NEGATIVE SENTIMENT PATTERNS
-- ============================================

-- Show loaded negative sentiment patterns
SELECT
  pattern,
  severity,
  auto_escalate,
  LEFT(escalation_message, 50) as message_preview
FROM negative_sentiment_patterns
WHERE is_active = true
ORDER BY severity DESC;

-- ============================================
-- SUMMARY
-- ============================================

SELECT
  'V3-PLS Status Report' as report,
  NOW() as timestamp;

SELECT
  'Pattern Learning Enabled' as setting,
  (SELECT config_value FROM pattern_learning_config WHERE config_key = 'enabled') as value
UNION ALL
SELECT
  'Shadow Mode',
  (SELECT config_value FROM pattern_learning_config WHERE config_key = 'shadow_mode')
UNION ALL
SELECT
  'Active Patterns',
  COUNT(*)::text
FROM decision_patterns WHERE is_active = true
UNION ALL
SELECT
  'Patterns with ClubAI Signature',
  COUNT(*)::text
FROM decision_patterns
WHERE is_active = true
  AND response_template LIKE '%- ClubAI%';

-- Done!
\echo 'V3-PLS activation complete!'