-- ============================================
-- Test Pattern Learning Configuration
-- Check current settings and verify toggles work
-- ============================================

-- 1. Check current pattern learning configuration
SELECT '=== CURRENT PATTERN LEARNING CONFIG ===' as section;
SELECT 
  config_key,
  config_value,
  description,
  CASE 
    WHEN config_key = 'enabled' THEN 
      CASE config_value 
        WHEN 'true' THEN '✅ Learning is ENABLED'
        ELSE '❌ Learning is DISABLED'
      END
    WHEN config_key = 'shadow_mode' THEN 
      CASE config_value 
        WHEN 'true' THEN '⚠️ Shadow mode (logs only)'
        ELSE '✅ Active mode (creates patterns)'
      END
    ELSE config_value
  END as status
FROM pattern_learning_config
WHERE config_key IN ('enabled', 'shadow_mode', 'min_confidence_to_suggest', 'min_confidence_to_act', 'min_occurrences_to_learn')
ORDER BY 
  CASE config_key
    WHEN 'enabled' THEN 1
    WHEN 'shadow_mode' THEN 2
    WHEN 'min_confidence_to_suggest' THEN 3
    WHEN 'min_confidence_to_act' THEN 4
    WHEN 'min_occurrences_to_learn' THEN 5
  END;

-- 2. Show pattern creation activity
SELECT '=== RECENT PATTERN ACTIVITY ===' as section;
SELECT 
  COUNT(*) as total_patterns,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_week,
  COUNT(*) FILTER (WHERE is_active = true) as active_patterns,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_patterns
FROM decision_patterns;

-- 3. Show most recent patterns
SELECT '=== MOST RECENT PATTERNS ===' as section;
SELECT 
  id,
  pattern_type,
  LEFT(trigger_text, 50) as trigger,
  confidence_score,
  is_active,
  auto_executable,
  created_at
FROM decision_patterns
ORDER BY created_at DESC
LIMIT 5;

-- 4. Instructions for testing
SELECT '=== HOW TO TEST THE TOGGLES ===' as section;
SELECT '1. Go to http://localhost:3002/operations (V3-PLS page)' as instruction
UNION ALL
SELECT '2. Click on the "Stats & Settings" tab'
UNION ALL
SELECT '3. Find the "Pattern Learning System" section (purple Brain icon)'
UNION ALL
SELECT '4. Toggle "Enable Pattern Learning" on/off'
UNION ALL
SELECT '5. Adjust confidence thresholds with sliders'
UNION ALL
SELECT '6. Click "Save Settings" button at the bottom'
UNION ALL
SELECT '7. Run this script again to verify changes persisted';