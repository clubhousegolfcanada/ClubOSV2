-- ============================================
-- Enable V3-PLS Pattern Learning System
-- Run this after migration 234 has been applied
-- ============================================

-- Step 1: Verify migration has run
DO $$
DECLARE
  pattern_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO pattern_count
  FROM decision_patterns
  WHERE created_from IN ('migrated', 'system');

  IF pattern_count = 0 THEN
    RAISE EXCEPTION 'Migration 234 has not been run yet. Please run migrations first.';
  END IF;

  RAISE NOTICE 'Found % migrated patterns', pattern_count;
END $$;

-- Step 2: Enable V3-PLS system
UPDATE pattern_learning_config
SET config_value = 'true', updated_at = NOW()
WHERE config_key = 'enabled';

UPDATE pattern_learning_config
SET config_value = 'false', updated_at = NOW()
WHERE config_key = 'shadow_mode';

-- Step 3: Activate proven patterns (gift cards)
UPDATE decision_patterns
SET
  is_active = true,
  auto_executable = false, -- Still require manual approval for auto-execution
  notes = notes || ' | Activated for suggestions on ' || NOW()::date
WHERE pattern_type = 'gift_cards'
  AND created_from = 'migrated';

-- Step 4: Show current status
SELECT
  'Configuration Status' as category,
  config_key,
  config_value,
  description
FROM pattern_learning_config
WHERE config_key IN ('enabled', 'shadow_mode', 'auto_execute_threshold', 'suggest_threshold')
ORDER BY config_key;

SELECT
  'Pattern Status' as category,
  pattern_type,
  trigger_text,
  is_active,
  auto_executable,
  confidence_score,
  CASE
    WHEN auto_executable AND is_active THEN 'AUTO-EXECUTING'
    WHEN is_active AND NOT auto_executable THEN 'SUGGESTING'
    ELSE 'DISABLED'
  END as status
FROM decision_patterns
WHERE created_from IN ('migrated', 'system')
ORDER BY pattern_type;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ V3-PLS Pattern Learning System ENABLED';
  RAISE NOTICE '';
  RAISE NOTICE 'Status:';
  RAISE NOTICE '  - System is now ACTIVE and will process messages';
  RAISE NOTICE '  - Shadow mode is OFF (suggestions will be shown)';
  RAISE NOTICE '  - Gift card pattern is enabled for SUGGESTIONS';
  RAISE NOTICE '  - Other patterns remain disabled for safety';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Monitor pattern suggestions in the UI';
  RAISE NOTICE '  2. Review operator responses to build confidence';
  RAISE NOTICE '  3. Manually enable patterns in Operations > V3-PLS when ready';
  RAISE NOTICE '  4. Promote to auto-executable only after proven success';
END $$;