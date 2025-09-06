-- Fix the pricing pattern trigger
-- The current pattern is looking for "Providing specific pricing information"
-- which is a description, not what customers actually ask

-- First, let's find the broken pricing pattern
SELECT id, pattern, response_template, trigger_keywords, confidence_score
FROM decision_patterns
WHERE pattern = 'Providing specific pricing information.'
OR response_template LIKE '%clubhouse247golf.com/pricing%';

-- Update the pattern to match actual customer questions about pricing
UPDATE decision_patterns
SET 
  pattern = 'What are your prices?',
  trigger_keywords = ARRAY[
    'price', 'pricing', 'cost', 'how much', 'rate', 'rates', 
    'fee', 'fees', 'charge', 'charges', 'pay', 'payment',
    'hourly', 'per hour', 'membership', 'package', 'packages'
  ],
  pattern_signature = MD5(LOWER(REGEXP_REPLACE('what are your prices', '[^a-z0-9\s]', '', 'g'))),
  is_active = true,
  automation_enabled = true,
  auto_executable = true
WHERE pattern = 'Providing specific pricing information.'
OR (response_template LIKE '%clubhouse247golf.com/pricing%' AND pattern_type = 'faq');

-- Also create additional pricing patterns for common variations
INSERT INTO decision_patterns (
  pattern_type, pattern_signature, pattern, trigger_keywords,
  response_template, actions_json, confidence_score, 
  source, created_by, is_active, automation_enabled, auto_executable,
  pattern_summary
) VALUES 
(
  'faq',
  MD5(LOWER(REGEXP_REPLACE('how much does it cost', '[^a-z0-9\s]', '', 'g'))),
  'How much does it cost?',
  ARRAY['cost', 'how much', 'price', 'pricing'],
  'www.clubhouse247golf.com/pricing is the best place. The website says it more elegantly than I do.',
  '[]'::jsonb,
  0.85,
  'manual',
  'system',
  true,
  true,
  true,
  'Directs customers to pricing page'
),
(
  'faq',
  MD5(LOWER(REGEXP_REPLACE('how much for an hour', '[^a-z0-9\s]', '', 'g'))),
  'How much for an hour?',
  ARRAY['hour', 'hourly', 'price', 'cost', 'rate'],
  'You can find our hourly rates at www.clubhouse247golf.com/pricing - we have different options depending on peak/off-peak times.',
  '[]'::jsonb,
  0.85,
  'manual',
  'system',
  true,
  true,
  true,
  'Directs customers to pricing page for hourly rates'
),
(
  'faq',
  MD5(LOWER(REGEXP_REPLACE('do you have membership', '[^a-z0-9\s]', '', 'g'))),
  'Do you have membership options?',
  ARRAY['membership', 'member', 'monthly', 'subscription', 'package'],
  'Yes! Check out our membership options at www.clubhouse247golf.com/pricing - we have several packages available.',
  '[]'::jsonb,
  0.85,
  'manual', 
  'system',
  true,
  true,
  true,
  'Directs customers to pricing page for memberships'
)
ON CONFLICT (pattern_signature) DO UPDATE
SET 
  trigger_keywords = EXCLUDED.trigger_keywords,
  is_active = true,
  automation_enabled = true,
  auto_executable = true;

-- Verify the fix
SELECT 
  pattern,
  response_template,
  trigger_keywords,
  confidence_score,
  is_active,
  automation_enabled,
  auto_executable
FROM decision_patterns
WHERE 
  response_template LIKE '%pricing%'
  OR pattern LIKE '%price%'
  OR pattern LIKE '%cost%'
  OR 'price' = ANY(trigger_keywords)
  OR 'pricing' = ANY(trigger_keywords)
ORDER BY confidence_score DESC;