-- ============================================
-- V3-PLS Message Reprocessing Script
-- Cleans old incorrect patterns and prepares for reprocessing
-- Date: September 6, 2025
-- ============================================

-- STEP 1: Backup existing patterns (just in case)
-- ============================================
CREATE TABLE IF NOT EXISTS decision_patterns_backup_20250906 AS 
SELECT * FROM decision_patterns;

-- Log what we're backing up
DO $$
BEGIN
  RAISE NOTICE 'Backed up % patterns to decision_patterns_backup_20250906', 
    (SELECT COUNT(*) FROM decision_patterns);
END $$;

-- STEP 2: Clean out old patterns that were created incorrectly
-- ============================================
-- Delete patterns that:
-- 1. Have low confidence (never improved from default)
-- 2. Have no executions (never actually used)
-- 3. Were created before we fixed the context gathering

DELETE FROM decision_patterns 
WHERE 
  confidence_score <= 0.50  -- Stuck at default confidence
  AND execution_count = 0   -- Never actually used
  AND created_at < '2025-09-06';  -- Created before today's fixes

-- Log what we deleted
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % old/unused patterns', deleted_count;
END $$;

-- STEP 3: Reset pattern learning statistics
-- ============================================
TRUNCATE TABLE pattern_execution_history CASCADE;
TRUNCATE TABLE pattern_suggestions_queue CASCADE;

-- STEP 4: Get existing conversations to reprocess
-- ============================================
-- This query finds all operator responses that could become patterns
-- We'll export this and run it through the pattern learning service

CREATE TEMP TABLE messages_to_reprocess AS
SELECT DISTINCT ON (oc.id)
  oc.id as conversation_id,
  oc.phone_number,
  oc.customer_name,
  oc.created_at as conversation_date,
  -- Get the last inbound message from customer
  (SELECT body FROM openphone_messages om1 
   WHERE om1.conversation_id = oc.id 
   AND om1.direction = 'inbound'
   ORDER BY om1.created_at DESC 
   LIMIT 1) as last_customer_message,
  -- Get the operator's response
  (SELECT body FROM openphone_messages om2 
   WHERE om2.conversation_id = oc.id 
   AND om2.direction = 'outbound'
   AND om2.created_at > (
     SELECT created_at FROM openphone_messages om3
     WHERE om3.conversation_id = oc.id 
     AND om3.direction = 'inbound'
     ORDER BY om3.created_at DESC 
     LIMIT 1
   )
   ORDER BY om2.created_at ASC 
   LIMIT 1) as operator_response
FROM openphone_conversations oc
WHERE EXISTS (
  -- Only conversations with both inbound and outbound messages
  SELECT 1 FROM openphone_messages om 
  WHERE om.conversation_id = oc.id 
  AND om.direction = 'inbound'
)
AND EXISTS (
  SELECT 1 FROM openphone_messages om 
  WHERE om.conversation_id = oc.id 
  AND om.direction = 'outbound'
)
ORDER BY oc.id, oc.created_at DESC;

-- STEP 5: Show sample of Q&A pairs to reprocess
-- ============================================
SELECT 
  COUNT(*) as total_conversations,
  COUNT(CASE WHEN last_customer_message IS NOT NULL 
         AND operator_response IS NOT NULL THEN 1 END) as valid_qa_pairs
FROM messages_to_reprocess;

-- Show first 10 Q&A pairs that would be learned
SELECT 
  customer_name,
  LEFT(last_customer_message, 100) as customer_asked,
  LEFT(operator_response, 100) as operator_answered
FROM messages_to_reprocess
WHERE last_customer_message IS NOT NULL 
  AND operator_response IS NOT NULL
  AND LENGTH(last_customer_message) > 10
  AND LENGTH(operator_response) > 10
LIMIT 10;

-- STEP 6: Export for processing
-- ============================================
-- Export to CSV for processing through the pattern learning service
-- This would be processed by a Node.js script that calls patternLearningService

\COPY (
  SELECT 
    conversation_id,
    phone_number,
    customer_name,
    last_customer_message,
    operator_response
  FROM messages_to_reprocess
  WHERE last_customer_message IS NOT NULL 
    AND operator_response IS NOT NULL
    AND LENGTH(last_customer_message) > 10
    AND LENGTH(operator_response) > 10
) TO '/tmp/messages_to_reprocess.csv' WITH CSV HEADER;

-- ============================================
-- Next Steps:
-- 1. Review the Q&A pairs above
-- 2. Run the Node.js reprocessing script (see reprocess-messages.ts)
-- 3. Patterns will be created from REAL operator responses
-- 4. View new patterns in V3-PLS page
-- ============================================

-- Show final status
SELECT 
  'Ready to reprocess' as status,
  COUNT(*) as conversations_with_qa_pairs
FROM messages_to_reprocess
WHERE last_customer_message IS NOT NULL 
  AND operator_response IS NOT NULL;