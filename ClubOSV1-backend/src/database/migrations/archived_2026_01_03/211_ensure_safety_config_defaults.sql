-- Migration: Ensure safety config defaults exist
-- This ensures that the pattern_learning_config table has default values for safety settings

-- UP
-- Insert default values if they don't exist
INSERT INTO pattern_learning_config (config_key, config_value, created_at, updated_at)
VALUES 
  ('blacklist_topics', '', NOW(), NOW()),
  ('escalation_keywords', '', NOW(), NOW()),
  ('require_approval_for_new', 'true', NOW(), NOW()),
  ('approval_threshold', '10', NOW(), NOW()),
  ('min_examples_required', '5', NOW(), NOW()),
  ('operator_override_weight', '2.0', NOW(), NOW())
ON CONFLICT (config_key) DO NOTHING;

-- DOWN
-- No rollback needed as we're just ensuring defaults exist