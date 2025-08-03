-- Fix gift card automation response to use correct URL and information
UPDATE ai_automation_features 
SET config = jsonb_set(
  config,
  '{response_template}',
  '"You can purchase gift cards at clubhouse247golf.com/gift-card/purchase — direct link, no friction."'::jsonb
)
WHERE feature_key = 'gift_cards';

-- Update the description to be more accurate
UPDATE ai_automation_features
SET description = 'Automatically respond to gift card purchase questions with direct link to purchase page'
WHERE feature_key = 'gift_cards';