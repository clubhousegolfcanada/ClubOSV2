-- Remove hardcoded response template - let assistant provide the response
UPDATE ai_automation_features 
SET config = jsonb_set(
  config - 'response_template',  -- Remove the response_template key
  '{minConfidence}',
  '0.7'::jsonb
)
WHERE feature_key = 'gift_cards';

-- Update the description to clarify it uses assistant knowledge
UPDATE ai_automation_features
SET description = 'Automatically respond to gift card questions using assistant knowledge'
WHERE feature_key = 'gift_cards';