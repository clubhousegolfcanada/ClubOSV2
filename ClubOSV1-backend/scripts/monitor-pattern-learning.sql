-- ============================================
-- Monitor Pattern Learning System
-- Date: 2025-09-08
-- Purpose: Track pattern creation and safety metrics
-- ============================================

-- Current system status
SELECT 
    '=== SYSTEM STATUS ===' as section,
    config_key,
    config_value,
    CASE 
        WHEN config_key = 'enabled' THEN 
            CASE WHEN config_value = 'true' THEN '🟢 Active' ELSE '🔴 Disabled' END
        WHEN config_key = 'shadow_mode' THEN 
            CASE WHEN config_value = 'true' THEN '🟢 Safe (Shadow)' ELSE '🟡 Live Mode' END
        ELSE config_value
    END as status
FROM pattern_learning_config
WHERE config_key IN ('enabled', 'shadow_mode', 'auto_execute_threshold', 'min_executions_for_auto')
ORDER BY config_key;

-- Pattern statistics
SELECT 
    '=== PATTERN STATISTICS ===' as section,
    COUNT(*) as total_patterns,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_patterns,
    COUNT(CASE WHEN auto_executable = true THEN 1 END) as auto_executable,
    COUNT(CASE WHEN confidence_score >= 0.95 THEN 1 END) as high_confidence,
    COUNT(CASE WHEN confidence_score >= 0.75 THEN 1 END) as medium_confidence,
    COUNT(CASE WHEN created_from = 'learned' THEN 1 END) as learned_patterns,
    COUNT(CASE WHEN first_seen >= NOW() - INTERVAL '24 hours' THEN 1 END) as created_last_24h,
    COUNT(CASE WHEN first_seen >= NOW() - INTERVAL '7 days' THEN 1 END) as created_last_week
FROM decision_patterns;

-- Recent pattern creation activity
SELECT 
    '=== RECENT PATTERNS (Last 24 Hours) ===' as section;

SELECT 
    id,
    pattern_type,
    LEFT(trigger_text, 60) as trigger_preview,
    confidence_score,
    is_active,
    auto_executable,
    execution_count,
    success_count,
    created_from,
    AGE(NOW(), first_seen) as age
FROM decision_patterns
WHERE first_seen >= NOW() - INTERVAL '24 hours'
ORDER BY first_seen DESC
LIMIT 10;

-- Check for any auto-executions (should be 0 in shadow mode)
SELECT 
    '=== AUTO-EXECUTION CHECK ===' as section,
    COUNT(*) as total_executions,
    COUNT(CASE WHEN was_auto_executed = true THEN 1 END) as auto_executions,
    COUNT(CASE WHEN execution_mode = 'shadow' THEN 1 END) as shadow_executions,
    COUNT(CASE WHEN execution_mode = 'auto' THEN 1 END) as live_auto_executions
FROM pattern_execution_history
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Pattern learning from operator responses
SELECT 
    '=== OPERATOR RESPONSE LEARNING ===' as section;

SELECT 
    DATE(created_at) as date,
    COUNT(*) as patterns_learned,
    COUNT(DISTINCT phone_number) as unique_customers,
    AVG(LENGTH(trigger_text)) as avg_trigger_length,
    AVG(LENGTH(response_template)) as avg_response_length
FROM decision_patterns
WHERE created_from = 'learned'
AND first_seen >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Pending patterns in queue
SELECT 
    '=== PENDING REVIEW QUEUE ===' as section,
    COUNT(*) as pending_patterns,
    MIN(created_at) as oldest_pending,
    MAX(created_at) as newest_pending
FROM pattern_execution_queue
WHERE status = 'pending';

-- Pattern quality metrics
SELECT 
    '=== PATTERN QUALITY ===' as section;

SELECT 
    pattern_type,
    COUNT(*) as count,
    AVG(confidence_score) as avg_confidence,
    AVG(execution_count) as avg_executions,
    AVG(CASE WHEN execution_count > 0 THEN success_count::float / execution_count ELSE 0 END) as success_rate
FROM decision_patterns
GROUP BY pattern_type
ORDER BY count DESC;

-- Recent OpenPhone conversations that could trigger learning
SELECT 
    '=== RECENT OPENPHONE ACTIVITY ===' as section;

SELECT 
    COUNT(*) as total_conversations,
    COUNT(CASE WHEN jsonb_array_length(messages) > 1 THEN 1 END) as multi_message_convos,
    COUNT(CASE WHEN unread_count > 0 THEN 1 END) as unread_conversations,
    MAX(updated_at) as last_activity
FROM openphone_conversations
WHERE updated_at >= NOW() - INTERVAL '24 hours';

-- Safety check: Verify no patterns are auto-executing
DO $$ 
DECLARE
    auto_exec_count INTEGER;
    active_high_conf_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO auto_exec_count 
    FROM pattern_execution_history 
    WHERE was_auto_executed = true 
    AND created_at >= NOW() - INTERVAL '24 hours';
    
    SELECT COUNT(*) INTO active_high_conf_count
    FROM decision_patterns
    WHERE is_active = true 
    AND auto_executable = true 
    AND confidence_score >= 0.95;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== SAFETY STATUS ===';
    
    IF auto_exec_count = 0 THEN
        RAISE NOTICE '✅ No auto-executions detected (SAFE)';
    ELSE
        RAISE NOTICE '⚠️ WARNING: % auto-executions detected!', auto_exec_count;
    END IF;
    
    IF active_high_conf_count = 0 THEN
        RAISE NOTICE '✅ No patterns set to auto-execute (SAFE)';
    ELSE
        RAISE NOTICE '⚠️ WARNING: % patterns could auto-execute!', active_high_conf_count;
    END IF;
    
    RAISE NOTICE '========================================';
END $$;