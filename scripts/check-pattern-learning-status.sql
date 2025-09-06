-- ============================================
-- V3-PLS Pattern Learning Status Check
-- Run this to see if automatic pattern learning is working
-- ============================================

-- 1. Check if pattern learning is enabled
SELECT '=== PATTERN LEARNING CONFIGURATION ===' as section;
SELECT 
  config_key,
  config_value,
  CASE 
    WHEN config_key = 'enabled' AND config_value = 'true' THEN '✅ ENABLED'
    WHEN config_key = 'enabled' AND config_value = 'false' THEN '❌ DISABLED - System will NOT learn'
    WHEN config_key = 'shadow_mode' AND config_value = 'true' THEN '⚠️  Shadow mode - Logs only'
    WHEN config_key = 'shadow_mode' AND config_value = 'false' THEN '✅ Active mode'
    ELSE config_value
  END as status
FROM pattern_learning_config
WHERE config_key IN ('enabled', 'shadow_mode', 'min_confidence_to_suggest', 'min_confidence_to_act', 'min_occurrences_to_learn')
ORDER BY config_key;

-- 2. Check pattern statistics
SELECT '=== PATTERN STATISTICS ===' as section;
SELECT 
  COUNT(*) as total_patterns,
  COUNT(*) FILTER (WHERE is_active = true) as active_patterns,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as patterns_last_7_days,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as patterns_last_24h,
  COUNT(*) FILTER (WHERE auto_executable = true) as auto_executable,
  ROUND(AVG(confidence_score)::numeric, 2) as avg_confidence
FROM decision_patterns;

-- 3. Check recent OpenPhone activity
SELECT '=== OPENPHONE ACTIVITY (Last 24h) ===' as section;
SELECT 
  COUNT(*) as total_conversations,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour,
  MAX(created_at) as most_recent_conversation
FROM openphone_conversations
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 4. Check recent pattern creation attempts
SELECT '=== RECENT PATTERNS CREATED (Last 7 days) ===' as section;
SELECT 
  id,
  pattern_type,
  LEFT(trigger_text, 50) as trigger_preview,
  confidence_score,
  is_active,
  auto_executable,
  created_at,
  created_from
FROM decision_patterns
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 5;

-- 5. Check pattern execution history
SELECT '=== PATTERN EXECUTION HISTORY (Last 24h) ===' as section;
SELECT 
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE execution_mode = 'auto') as auto_executions,
  COUNT(*) FILTER (WHERE execution_mode = 'suggested') as suggestions,
  COUNT(*) FILTER (WHERE execution_status = 'success') as successful,
  COUNT(*) FILTER (WHERE execution_status = 'failure') as failed
FROM pattern_execution_history
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 6. Check for learning opportunities (conversations without patterns)
SELECT '=== LEARNING OPPORTUNITIES ===' as section;
SELECT 
  COUNT(*) as messages_without_patterns
FROM conversation_messages
WHERE pattern_id IS NULL
  AND sender_type = 'customer'
  AND created_at > NOW() - INTERVAL '24 hours';

-- 7. Diagnosis
SELECT '=== DIAGNOSIS ===' as section;
SELECT 
  CASE 
    WHEN (SELECT config_value FROM pattern_learning_config WHERE config_key = 'enabled') = 'false' 
      THEN '❌ PROBLEM: Pattern learning is DISABLED. Run enable-v3-pls.sql to enable.'
    WHEN (SELECT config_value FROM pattern_learning_config WHERE config_key = 'shadow_mode') = 'true'
      THEN '⚠️  WARNING: Shadow mode is ON. Patterns are logged but not created.'
    WHEN (SELECT COUNT(*) FROM openphone_conversations WHERE created_at > NOW() - INTERVAL '24 hours') = 0
      THEN '⚠️  WARNING: No OpenPhone messages in last 24h. Check webhook configuration.'
    WHEN (SELECT COUNT(*) FROM decision_patterns WHERE created_at > NOW() - INTERVAL '7 days') = 0
      THEN '⚠️  WARNING: No patterns created in last 7 days. Operators may not be responding or system may have issues.'
    ELSE '✅ System appears to be configured correctly.'
  END as diagnosis;

-- 8. Quick enable command (commented out for safety)
SELECT '=== TO ENABLE PATTERN LEARNING ===' as section;
SELECT 'Run this command to enable:' as instruction;
SELECT 'UPDATE pattern_learning_config SET config_value = ''true'' WHERE config_key = ''enabled'';' as command;