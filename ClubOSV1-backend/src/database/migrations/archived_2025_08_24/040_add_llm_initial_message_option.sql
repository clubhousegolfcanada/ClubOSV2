-- Add option to use LLM for all initial messages instead of pattern matching
-- This allows for more flexible and accurate automation detection

-- Add a new system config for LLM-based initial message handling
INSERT INTO system_config (key, value, description, updated_at)
VALUES (
  'ai_automation_use_llm_for_initial', 
  'false', 
  'Use LLM to analyze all initial messages instead of pattern matching',
  NOW()
)
ON CONFLICT (key) DO UPDATE 
SET description = EXCLUDED.description,
    updated_at = NOW();

-- Add a column to track if this is an initial message in the automation usage
ALTER TABLE ai_automation_usage 
ADD COLUMN IF NOT EXISTS is_initial_message BOOLEAN DEFAULT false;

-- Add feature for general LLM analysis
INSERT INTO ai_automation_features (feature_key, feature_name, description, category, enabled, config, required_permissions)
VALUES (
  'llm_initial_analysis',
  'LLM Initial Message Analysis',
  'Use AI to understand and respond to all initial customer messages',
  'customer_service',
  false,
  '{"minConfidence": 0.7, "responseSource": "database", "maxResponses": 1, "analyzeAllInitial": true}'::jsonb,
  ARRAY['admin', 'operator']
)
ON CONFLICT (feature_key) DO UPDATE
SET description = EXCLUDED.description,
    updated_at = NOW();