-- Add option to use LLM for all messages, not just initial ones
-- This ensures automation works even in existing conversations

-- Add a new feature flag for using LLM on all messages
INSERT INTO ai_automation_features (
    feature_key, 
    feature_name, 
    description, 
    category, 
    enabled, 
    config, 
    required_permissions
)
VALUES (
    'llm_all_messages',
    'LLM Analysis for All Messages',
    'Use AI to analyze all incoming messages, not just initial ones in new conversations',
    'system',
    true,
    '{"minConfidence": 0.7, "analyzeAllMessages": true}'::jsonb,
    ARRAY['admin']
)
ON CONFLICT (feature_key) DO UPDATE
SET enabled = true,
    updated_at = NOW();

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
    '{"action": "enabled_llm_for_all_messages"}'::jsonb,
    '{"migration": "047_enable_llm_for_all_messages"}'::jsonb,
    true,
    0,
    NOW()
FROM ai_automation_features 
WHERE feature_key = 'llm_all_messages';