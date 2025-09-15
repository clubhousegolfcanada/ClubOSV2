-- Script to consolidate split OpenPhone conversations
-- This merges multiple conversation records for the same phone number into one

-- First, create a backup table
CREATE TABLE IF NOT EXISTS openphone_conversations_backup AS
SELECT * FROM openphone_conversations;

-- For each phone number with multiple conversations, merge them
WITH merged_conversations AS (
  SELECT
    phone_number,
    MIN(id) as keep_id,
    MAX(customer_name) as best_customer_name,
    MAX(employee_name) as best_employee_name,
    jsonb_agg(messages ORDER BY created_at) as all_messages_arrays,
    MIN(created_at) as first_created,
    MAX(created_at) as last_updated,
    SUM(unread_count) as total_unread
  FROM openphone_conversations
  WHERE phone_number IN (
    -- Only process phone numbers with multiple conversations
    SELECT phone_number
    FROM openphone_conversations
    GROUP BY phone_number
    HAVING COUNT(*) > 1
  )
  GROUP BY phone_number
),
flattened_messages AS (
  SELECT
    phone_number,
    keep_id,
    best_customer_name,
    best_employee_name,
    -- Flatten all message arrays into a single array
    (
      SELECT jsonb_agg(msg ORDER BY msg->>'createdAt', msg->>'timestamp', msg->>'created_at')
      FROM (
        SELECT jsonb_array_elements(unnest(all_messages_arrays)) as msg
      ) messages
    ) as all_messages,
    first_created,
    last_updated,
    total_unread
  FROM merged_conversations
)
-- Update the keeper conversation with all messages
UPDATE openphone_conversations oc
SET
  messages = fm.all_messages,
  customer_name = fm.best_customer_name,
  employee_name = fm.best_employee_name,
  created_at = fm.first_created,
  updated_at = fm.last_updated,
  unread_count = fm.total_unread
FROM flattened_messages fm
WHERE oc.id = fm.keep_id;

-- Delete the duplicate conversations (keeping the one with MIN(id))
DELETE FROM openphone_conversations
WHERE id IN (
  SELECT id
  FROM openphone_conversations oc1
  WHERE EXISTS (
    SELECT 1
    FROM openphone_conversations oc2
    WHERE oc2.phone_number = oc1.phone_number
    AND oc2.id < oc1.id
  )
);

-- Report results
SELECT
  'Consolidation Complete' as status,
  COUNT(DISTINCT phone_number) as unique_phones,
  COUNT(*) as total_conversations,
  SUM(jsonb_array_length(messages)) as total_messages
FROM openphone_conversations;