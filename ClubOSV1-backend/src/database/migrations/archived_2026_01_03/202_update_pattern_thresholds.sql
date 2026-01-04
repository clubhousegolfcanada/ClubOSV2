-- Update V3-PLS pattern learning thresholds for faster auto-execution
-- This allows patterns to auto-send after just 3 successful approvals

-- Update confidence thresholds
UPDATE pattern_learning_config SET config_value = '0.85' WHERE config_key = 'auto_execute_threshold';
UPDATE pattern_learning_config SET config_value = '0.60' WHERE config_key = 'suggest_threshold';  
UPDATE pattern_learning_config SET config_value = '0.40' WHERE config_key = 'queue_threshold';

-- Update confidence change rates for faster learning
UPDATE pattern_learning_config SET config_value = '0.15' WHERE config_key = 'confidence_increase_success';
UPDATE pattern_learning_config SET config_value = '0.10' WHERE config_key = 'confidence_increase_modified';
UPDATE pattern_learning_config SET config_value = '0.20' WHERE config_key = 'confidence_decrease_failure';

-- Reduce minimum executions needed for auto-send from 20 to 3
UPDATE pattern_learning_config SET config_value = '3' WHERE config_key = 'min_executions_for_auto';

-- Enable the system and turn off shadow mode
UPDATE pattern_learning_config SET config_value = 'true' WHERE config_key = 'enabled';
UPDATE pattern_learning_config SET config_value = 'false' WHERE config_key = 'shadow_mode';

-- Add description updates
UPDATE pattern_learning_config 
SET description = 'Pattern auto-executes after reaching 85% confidence (approx 3 approvals)'
WHERE config_key = 'auto_execute_threshold';

UPDATE pattern_learning_config 
SET description = 'Pattern needs only 3 successful uses before auto-sending'
WHERE config_key = 'min_executions_for_auto';

UPDATE pattern_learning_config 
SET description = 'Each approval increases confidence by 15% (3 approvals = 45% increase)'
WHERE config_key = 'confidence_increase_success';