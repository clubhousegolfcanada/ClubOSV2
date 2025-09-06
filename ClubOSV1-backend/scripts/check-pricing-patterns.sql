-- Check pricing patterns and their configuration
-- This script helps debug why pricing patterns aren't working

-- 1. Check if pattern learning is enabled
SELECT config_key, config_value 
FROM pattern_learning_config 
WHERE config_key IN ('enabled', 'shadow_mode', 'auto_execute_threshold');

-- 2. Find all pricing-related patterns
SELECT 
  id,
  pattern,
  pattern_type,
  response_template,
  confidence_score,
  is_active,
  automation_enabled,
  auto_executable,
  execution_count,
  success_count,
  trigger_keywords
FROM decision_patterns
WHERE 
  pattern ILIKE '%price%' 
  OR pattern ILIKE '%cost%' 
  OR pattern ILIKE '%how much%'
  OR pattern ILIKE '%rate%'
  OR pattern ILIKE '%fee%'
  OR response_template ILIKE '%$%'
ORDER BY confidence_score DESC;

-- 3. Check if pricing keywords are blacklisted
SELECT * FROM pattern_safety_settings
WHERE 
  'price' = ANY(blacklist_topics)
  OR 'cost' = ANY(blacklist_topics)
  OR 'pricing' = ANY(blacklist_topics)
  OR 'rate' = ANY(blacklist_topics);

-- 4. Check recent pattern executions for pricing questions
SELECT 
  pm.id,
  pm.pattern_id,
  pm.customer_message,
  pm.matched_confidence,
  pm.was_auto_executed,
  pm.operator_action,
  pm.created_at,
  dp.pattern,
  dp.response_template
FROM pattern_matches pm
LEFT JOIN decision_patterns dp ON pm.pattern_id = dp.id
WHERE 
  pm.customer_message ILIKE '%price%'
  OR pm.customer_message ILIKE '%cost%'
  OR pm.customer_message ILIKE '%how much%'
ORDER BY pm.created_at DESC
LIMIT 10;

-- 5. Check if there are any working patterns for comparison
SELECT 
  pattern,
  pattern_type,
  confidence_score,
  is_active,
  automation_enabled,
  auto_executable,
  execution_count,
  trigger_keywords
FROM decision_patterns
WHERE 
  is_active = true
  AND automation_enabled = true
  AND auto_executable = true
  AND confidence_score >= 0.85
ORDER BY execution_count DESC
LIMIT 5;

-- 6. Check pattern learning examples for pricing
SELECT 
  id,
  customer_message,
  operator_response,
  pattern_signature,
  created_at
FROM pattern_learning_examples
WHERE 
  customer_message ILIKE '%price%'
  OR customer_message ILIKE '%cost%'
  OR customer_message ILIKE '%how much%'
ORDER BY created_at DESC
LIMIT 5;