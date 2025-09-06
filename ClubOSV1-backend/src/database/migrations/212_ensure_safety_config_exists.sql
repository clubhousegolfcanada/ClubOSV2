-- Migration: Ensure Safety Config Exists
-- Purpose: Ensure all required safety configuration rows exist in pattern_learning_config
-- This fixes the issue where blacklist topics don't persist after saving

-- Ensure blacklist_topics exists
INSERT INTO pattern_learning_config (config_key, config_value, description)
VALUES ('blacklist_topics', '', 'Comma-separated list of topics that should never trigger auto-responses')
ON CONFLICT (config_key) DO NOTHING;

-- Ensure escalation_keywords exists
INSERT INTO pattern_learning_config (config_key, config_value, description)
VALUES ('escalation_keywords', '', 'Comma-separated list of keywords that trigger operator alerts')
ON CONFLICT (config_key) DO NOTHING;

-- Ensure require_approval_for_new exists
INSERT INTO pattern_learning_config (config_key, config_value, description)
VALUES ('require_approval_for_new', 'true', 'Whether new patterns require operator approval before auto-executing')
ON CONFLICT (config_key) DO NOTHING;

-- Ensure approval_threshold exists
INSERT INTO pattern_learning_config (config_key, config_value, description)
VALUES ('approval_threshold', '10', 'Number of successful uses required before a pattern can auto-execute')
ON CONFLICT (config_key) DO NOTHING;

-- Ensure min_examples_required exists
INSERT INTO pattern_learning_config (config_key, config_value, description)
VALUES ('min_examples_required', '5', 'Minimum number of similar examples required before creating a pattern')
ON CONFLICT (config_key) DO NOTHING;

-- Ensure operator_override_weight exists
INSERT INTO pattern_learning_config (config_key, config_value, description)
VALUES ('operator_override_weight', '2.0', 'How much more weight to give operator corrections vs auto-learned patterns')
ON CONFLICT (config_key) DO NOTHING;

-- Add default safety keywords if blacklist is empty
UPDATE pattern_learning_config 
SET config_value = 'medical,legal,lawyer,lawsuit,refund,injury,accident,emergency,police,insurance,compensation,harassment,discrimination'
WHERE config_key = 'blacklist_topics' 
AND (config_value IS NULL OR config_value = '');

-- Add default escalation keywords if empty
UPDATE pattern_learning_config 
SET config_value = 'angry,upset,furious,manager,complaint,unacceptable,terrible,worst,sue,attorney,emergency,urgent,immediately'
WHERE config_key = 'escalation_keywords' 
AND (config_value IS NULL OR config_value = '');