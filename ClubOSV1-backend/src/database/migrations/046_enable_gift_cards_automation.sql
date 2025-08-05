-- Enable gift card automation feature
-- This allows the system to automatically respond to gift card inquiries

UPDATE ai_automation_features 
SET enabled = true,
    updated_at = NOW()
WHERE feature_key = 'gift_cards';

-- Also update the response to use the assistant instead of hardcoded template
UPDATE ai_automation_features 
SET config = jsonb_set(
    config,
    '{useAssistant}',
    'true'::jsonb
)
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
    '{"action": "enabled_by_migration"}'::jsonb,
    '{"migration": "046_enable_gift_cards_automation"}'::jsonb,
    true,
    0,
    NOW()
FROM ai_automation_features 
WHERE feature_key = 'gift_cards';