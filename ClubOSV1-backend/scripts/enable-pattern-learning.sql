-- ============================================
-- Enable Pattern Learning System (Shadow Mode)
-- Date: 2025-09-08
-- Purpose: Enable pattern learning from OpenPhone conversations
--          while keeping all patterns inactive and safe
-- ============================================

-- Check if tables exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'decision_patterns') THEN
        RAISE NOTICE 'Pattern learning tables do not exist. Please run migration 201_pattern_learning_system.sql first';
    ELSE
        RAISE NOTICE 'Pattern learning tables found. Proceeding with configuration...';
    END IF;
END $$;

-- Check current configuration
SELECT 
    'CURRENT STATUS:' as info,
    config_key, 
    config_value,
    description 
FROM pattern_learning_config 
WHERE config_key IN ('enabled', 'shadow_mode', 'auto_execute_threshold', 'min_executions_for_auto')
ORDER BY 
    CASE config_key
        WHEN 'enabled' THEN 1
        WHEN 'shadow_mode' THEN 2
        WHEN 'auto_execute_threshold' THEN 3
        WHEN 'min_executions_for_auto' THEN 4
    END;

-- Enable pattern learning but keep in shadow mode for safety
UPDATE pattern_learning_config 
SET config_value = 'true', updated_at = NOW() 
WHERE config_key = 'enabled';

-- IMPORTANT: Keep shadow mode ON (learn but don't execute)
UPDATE pattern_learning_config 
SET config_value = 'true', updated_at = NOW() 
WHERE config_key = 'shadow_mode';

-- Optional: Add conversation window setting for better learning
INSERT INTO pattern_learning_config (config_key, config_value, description)
VALUES ('conversation_window_minutes', '60', 'Minutes to wait for operator responses before creating pattern')
ON CONFLICT (config_key) DO UPDATE 
SET config_value = '60', updated_at = NOW();

-- Optional: Add minimum response length to avoid learning from quick acknowledgments
INSERT INTO pattern_learning_config (config_key, config_value, description)
VALUES ('min_response_length', '20', 'Minimum characters in operator response to trigger learning')
ON CONFLICT (config_key) DO UPDATE 
SET config_value = '20', updated_at = NOW();

-- Verify configuration after update
SELECT 
    'NEW STATUS:' as info,
    config_key, 
    config_value,
    CASE 
        WHEN config_key = 'enabled' AND config_value = 'true' THEN '✅ Learning ENABLED'
        WHEN config_key = 'shadow_mode' AND config_value = 'true' THEN '✅ Shadow Mode ON (Safe)'
        WHEN config_key = 'auto_execute_threshold' THEN '⚠️ Threshold: ' || config_value || ' (95% required)'
        WHEN config_key = 'min_executions_for_auto' THEN '⚠️ Min executions: ' || config_value
        ELSE description
    END as status
FROM pattern_learning_config 
WHERE config_key IN ('enabled', 'shadow_mode', 'auto_execute_threshold', 'min_executions_for_auto', 'conversation_window_minutes', 'min_response_length')
ORDER BY 
    CASE config_key
        WHEN 'enabled' THEN 1
        WHEN 'shadow_mode' THEN 2
        WHEN 'auto_execute_threshold' THEN 3
        WHEN 'min_executions_for_auto' THEN 4
        ELSE 5
    END;

-- Check pattern defaults to ensure safety
SELECT 
    'PATTERN DEFAULTS:' as info,
    column_name,
    column_default,
    CASE 
        WHEN column_name = 'is_active' AND column_default = 'false' THEN '✅ Safe: Patterns start INACTIVE'
        WHEN column_name = 'auto_executable' AND column_default = 'false' THEN '✅ Safe: No auto-execution'
        WHEN column_name = 'requires_confirmation' AND column_default = 'true' THEN '✅ Safe: Confirmation required'
        WHEN column_name = 'confidence_score' THEN '✅ Starting confidence: ' || column_default
        ELSE 'Default: ' || COALESCE(column_default::text, 'NULL')
    END as safety_check
FROM information_schema.columns 
WHERE table_name = 'decision_patterns' 
AND column_name IN ('is_active', 'auto_executable', 'requires_confirmation', 'confidence_score');

-- Count existing patterns (should be 0 or very few)
SELECT 
    'EXISTING PATTERNS:' as info,
    COUNT(*) as total_patterns,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_patterns,
    COUNT(CASE WHEN auto_executable = true THEN 1 END) as auto_executable_patterns,
    AVG(confidence_score) as avg_confidence
FROM decision_patterns;

-- Show most recent patterns (if any)
SELECT 
    'RECENT PATTERNS:' as info,
    id,
    pattern_type,
    LEFT(trigger_text, 50) as trigger_preview,
    confidence_score,
    is_active,
    auto_executable,
    created_from,
    first_seen::date as created_date
FROM decision_patterns
ORDER BY first_seen DESC
LIMIT 5;

-- Create monitoring view for tracking pattern creation
CREATE OR REPLACE VIEW pattern_learning_monitor AS
SELECT 
    DATE(first_seen) as date,
    COUNT(*) as patterns_created,
    AVG(confidence_score) as avg_confidence,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_count,
    COUNT(CASE WHEN auto_executable = true THEN 1 END) as auto_exec_count,
    COUNT(CASE WHEN execution_count > 0 THEN 1 END) as used_count
FROM decision_patterns
GROUP BY DATE(first_seen)
ORDER BY date DESC;

-- Final status message
DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PATTERN LEARNING SYSTEM STATUS:';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Pattern learning is now ENABLED';
    RAISE NOTICE '✅ Shadow mode is ON (safe - no auto-execution)';
    RAISE NOTICE '✅ All new patterns will be INACTIVE by default';
    RAISE NOTICE '✅ Patterns will appear in V3-PLS page for review';
    RAISE NOTICE '';
    RAISE NOTICE 'NEXT STEPS:';
    RAISE NOTICE '1. Monitor pattern creation with: SELECT * FROM pattern_learning_monitor;';
    RAISE NOTICE '2. Check V3-PLS page at: /operations (V3-PLS tab)';
    RAISE NOTICE '3. Review patterns before manual activation';
    RAISE NOTICE '';
    RAISE NOTICE 'TO DISABLE IF NEEDED:';
    RAISE NOTICE 'UPDATE pattern_learning_config SET config_value = ''false'' WHERE config_key = ''enabled'';';
    RAISE NOTICE '========================================';
END $$;