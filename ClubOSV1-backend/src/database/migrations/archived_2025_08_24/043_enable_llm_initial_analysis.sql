-- Enable LLM initial analysis by default
-- This will make the system analyze all initial messages with AI instead of just pattern matching

UPDATE ai_automation_features 
SET enabled = true,
    updated_at = NOW()
WHERE feature_key = 'llm_initial_analysis';

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
    '{"action": "enabled_by_default"}'::jsonb,
    '{"migration": "043_enable_llm_initial_analysis"}'::jsonb,
    true,
    0,
    NOW()
FROM ai_automation_features 
WHERE feature_key = 'llm_initial_analysis';