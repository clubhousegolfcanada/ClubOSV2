-- SIMPLE PATTERN LEARNING ACTIVATION
-- Just the essential commands to turn it on safely

-- Enable pattern learning
UPDATE pattern_learning_config 
SET config_value = 'true', updated_at = NOW() 
WHERE config_key = 'enabled';

-- Keep shadow mode ON for safety
UPDATE pattern_learning_config 
SET config_value = 'true', updated_at = NOW() 
WHERE config_key = 'shadow_mode';

-- Show status
SELECT 
    config_key,
    config_value,
    CASE 
        WHEN config_key = 'enabled' AND config_value = 'true' THEN '✅ LEARNING ENABLED'
        WHEN config_key = 'shadow_mode' AND config_value = 'true' THEN '✅ SHADOW MODE (SAFE)'
        ELSE config_value
    END as status
FROM pattern_learning_config
WHERE config_key IN ('enabled', 'shadow_mode', 'auto_execute_threshold', 'min_executions_for_auto')
ORDER BY config_key;