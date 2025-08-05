-- Lower the confidence threshold for gift card automation
-- The current threshold of 0.7 is too high for simple queries like "do you sell gift cards?"

UPDATE ai_automation_features 
SET config = jsonb_set(
    config,
    '{minConfidence}',
    '0.5'::jsonb
),
updated_at = NOW()
WHERE feature_key = 'gift_cards';

-- Log the change
INSERT INTO ai_automation_usage (
    feature_id,
    trigger_type,
    input_data,
    output_data,
    success,
    execution_time_ms,
    created_at
)
SELECT 
    id,
    'system',
    '{"action": "lowered_confidence_threshold"}'::jsonb,
    '{"migration": "050_lower_gift_card_confidence", "old": 0.7, "new": 0.5}'::jsonb,
    true,
    0,
    NOW()
FROM ai_automation_features 
WHERE feature_key = 'gift_cards';