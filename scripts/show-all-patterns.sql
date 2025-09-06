-- ============================================
-- Show ALL Patterns (Including Inactive)
-- This reveals patterns that were created but not displayed
-- ============================================

-- Summary of all patterns
SELECT '=== PATTERN SUMMARY ===' as section;
SELECT 
  COUNT(*) as total_patterns,
  COUNT(*) FILTER (WHERE is_active = true) as active_patterns,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_patterns,
  COUNT(*) FILTER (WHERE auto_executable = true) as auto_executable,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as created_last_week,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as created_last_month
FROM decision_patterns;

-- Show inactive patterns that might have been created automatically
SELECT '=== INACTIVE PATTERNS (Hidden from UI) ===' as section;
SELECT 
  id,
  pattern_type,
  LEFT(trigger_text, 60) as trigger_preview,
  LEFT(response_template, 100) as response_preview,
  confidence_score,
  is_active,
  auto_executable,
  created_at,
  created_from
FROM decision_patterns
WHERE is_active = false
ORDER BY created_at DESC
LIMIT 20;

-- Show all recent patterns regardless of status
SELECT '=== ALL RECENT PATTERNS (Last 30 days) ===' as section;
SELECT 
  id,
  pattern_type,
  LEFT(trigger_text, 40) as trigger,
  confidence_score,
  CASE 
    WHEN is_active THEN '✅ Active'
    ELSE '❌ Inactive'
  END as status,
  CASE 
    WHEN auto_executable THEN '🚀 Auto'
    ELSE '👤 Manual'
  END as mode,
  execution_count as uses,
  created_at::date as created
FROM decision_patterns
WHERE created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- Activate all inactive patterns (COMMENTED FOR SAFETY)
SELECT '=== TO ACTIVATE ALL PATTERNS ===' as section;
SELECT 'To make ALL patterns visible in UI, run:' as instruction;
SELECT 'UPDATE decision_patterns SET is_active = true WHERE is_active = false;' as command;

-- Or activate only high-confidence patterns
SELECT '=== TO ACTIVATE HIGH-CONFIDENCE PATTERNS ===' as section;
SELECT 'To activate patterns with 60%+ confidence:' as instruction;
SELECT 'UPDATE decision_patterns SET is_active = true WHERE is_active = false AND confidence_score >= 0.60;' as command;