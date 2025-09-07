-- Fix the pricing pattern trigger to match actual customer questions
-- The current trigger_text is "Providing specific pricing information" which no customer would say

-- First, check what pricing patterns exist
SELECT id, trigger_text, response_template, confidence_score, is_active, auto_executable
FROM decision_patterns
WHERE trigger_text = 'Providing specific pricing information.'
   OR response_template LIKE '%clubhouse247golf.com/pricing%';

-- Update the pricing pattern to have proper trigger text and keywords
UPDATE decision_patterns
SET 
  trigger_text = 'How much does it cost?',
  trigger_examples = ARRAY[
    'How much does it cost?',
    'What are your prices?',
    'What''s the pricing?',
    'How much for an hour?',
    'What are your rates?',
    'How much do you charge?',
    'Can you tell me the price?',
    'What''s the cost per hour?',
    'What does it cost to play?',
    'How much is it?'
  ],
  trigger_keywords = ARRAY[
    'price', 'pricing', 'cost', 'how much', 'rate', 'rates', 
    'fee', 'fees', 'charge', 'charges', 'pay', 'payment',
    'hourly', 'per hour', 'membership', 'package', 'packages',
    'much', 'dollar', 'dollars', '$'
  ],
  pattern_signature = MD5(LOWER(REGEXP_REPLACE('how much does it cost', '[^a-z0-9\s]', '', 'g'))),
  is_active = true,
  auto_executable = true,
  confidence_score = 0.85,
  semantic_search_enabled = true,
  automation_name = 'Pricing Information',
  automation_description = 'Directs customers to pricing page when they ask about costs'
WHERE trigger_text = 'Providing specific pricing information.'
   OR (response_template LIKE '%clubhouse247golf.com/pricing%' 
       AND pattern_type = 'faq'
       AND trigger_text != 'How much does it cost?');

-- Also update any automation_enabled flags if that column exists
UPDATE decision_patterns
SET automation_enabled = true
WHERE response_template LIKE '%clubhouse247golf.com/pricing%'
  AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'decision_patterns' 
    AND column_name = 'automation_enabled'
  );

-- Verify the fix
SELECT 'After Fix - Pricing Patterns:' as info;
SELECT 
  id,
  trigger_text,
  response_template,
  confidence_score,
  is_active,
  auto_executable,
  automation_name,
  trigger_keywords[1:5] as sample_keywords
FROM decision_patterns
WHERE response_template LIKE '%pricing%'
   OR trigger_text LIKE '%price%'
   OR trigger_text LIKE '%cost%'
   OR trigger_text LIKE '%how much%'
ORDER BY confidence_score DESC;