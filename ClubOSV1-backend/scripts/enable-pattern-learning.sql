-- Enable pattern learning and check configuration
-- This script ensures the V3-PLS system is properly configured

-- 1. Check current configuration
SELECT 'Current Pattern Learning Configuration:' as info;
SELECT config_key, config_value 
FROM pattern_learning_config 
WHERE config_key IN ('enabled', 'shadow_mode', 'auto_execute_threshold')
ORDER BY config_key;

-- 2. Enable pattern learning (not shadow mode)
UPDATE pattern_learning_config SET config_value = 'true' WHERE config_key = 'enabled';
UPDATE pattern_learning_config SET config_value = 'false' WHERE config_key = 'shadow_mode';

-- If config doesn't exist, insert it
INSERT INTO pattern_learning_config (config_key, config_value)
VALUES 
  ('enabled', 'true'),
  ('shadow_mode', 'false'),
  ('auto_execute_threshold', '0.85')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

-- 3. Fix the pricing pattern trigger
UPDATE decision_patterns
SET 
  pattern = 'How much does it cost?',
  trigger_keywords = ARRAY[
    'price', 'pricing', 'cost', 'how much', 'rate', 'rates', 
    'fee', 'fees', 'charge', 'much for', 'pay', 'payment',
    'hourly', 'per hour', 'membership', 'package'
  ],
  pattern_signature = MD5(LOWER(REGEXP_REPLACE('how much does it cost', '[^a-z0-9\s]', '', 'g'))),
  is_active = true,
  automation_enabled = true,
  auto_executable = true,
  confidence_score = 0.85
WHERE pattern = 'Providing specific pricing information.'
OR (response_template LIKE '%clubhouse247golf.com/pricing%' AND pattern_type = 'faq');

-- 4. Verify configuration
SELECT 'After Update - Pattern Learning Configuration:' as info;
SELECT config_key, config_value 
FROM pattern_learning_config 
WHERE config_key IN ('enabled', 'shadow_mode', 'auto_execute_threshold')
ORDER BY config_key;

-- 5. Show pricing patterns
SELECT 'Pricing Patterns:' as info;
SELECT 
  id,
  pattern,
  response_template,
  confidence_score,
  is_active,
  automation_enabled,
  auto_executable,
  trigger_keywords
FROM decision_patterns
WHERE 
  response_template LIKE '%pricing%'
  OR pattern LIKE '%price%'
  OR pattern LIKE '%cost%'
  OR pattern LIKE '%how much%'
ORDER BY confidence_score DESC;

-- 6. Test what pattern signature would be generated for common questions
SELECT 'Pattern Signatures for Common Pricing Questions:' as info;
SELECT 
  'how much does it cost' as question,
  MD5(LOWER(REGEXP_REPLACE('how much does it cost', '[^a-z0-9\s]', '', 'g'))) as signature
UNION ALL
SELECT 
  'what are your prices',
  MD5(LOWER(REGEXP_REPLACE('what are your prices', '[^a-z0-9\s]', '', 'g')))
UNION ALL
SELECT 
  'whats the price',
  MD5(LOWER(REGEXP_REPLACE('whats the price', '[^a-z0-9\s]', '', 'g')))
UNION ALL
SELECT 
  'how much for an hour',
  MD5(LOWER(REGEXP_REPLACE('how much for an hour', '[^a-z0-9\s]', '', 'g')));

-- 7. Check embeddings if they exist
SELECT 'Embedding Cache Status:' as info;
SELECT COUNT(*) as cached_embeddings FROM embedding_cache WHERE created_at > NOW() - INTERVAL '7 days';