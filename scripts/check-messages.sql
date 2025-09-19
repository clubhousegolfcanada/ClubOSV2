-- Check recent messages in the database
-- This script analyzes messages stored in openphone_conversations

-- 1. Count total conversations
SELECT COUNT(*) as total_conversations FROM openphone_conversations;

-- 2. Check for recent messages (last 7 days)
SELECT
  phone_number,
  customer_name,
  jsonb_array_length(messages) as message_count,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(updated_at, created_at))) / 86400 as days_ago
FROM openphone_conversations
WHERE updated_at > NOW() - INTERVAL '7 days'
   OR created_at > NOW() - INTERVAL '7 days'
ORDER BY COALESCE(updated_at, created_at) DESC
LIMIT 20;

-- 3. Get most recent message from each conversation
WITH recent_conversations AS (
  SELECT
    phone_number,
    customer_name,
    messages,
    jsonb_array_length(messages) as msg_count,
    COALESCE(updated_at, created_at) as last_activity
  FROM openphone_conversations
  WHERE messages IS NOT NULL
    AND jsonb_array_length(messages) > 0
  ORDER BY COALESCE(updated_at, created_at) DESC
  LIMIT 10
)
SELECT
  phone_number,
  customer_name,
  msg_count,
  last_activity,
  messages->-1->>'createdAt' as last_msg_time,
  messages->-1->>'direction' as last_msg_direction,
  LEFT(messages->-1->>'body', 100) as last_msg_preview
FROM recent_conversations;

-- 4. Check for messages in the last 24 hours
SELECT
  phone_number,
  customer_name,
  messages->-1->>'createdAt' as last_message_time,
  messages->-1->>'direction' as direction,
  LEFT(messages->-1->>'body', 100) as message_preview
FROM openphone_conversations
WHERE messages IS NOT NULL
  AND jsonb_array_length(messages) > 0
  AND (messages->-1->>'createdAt')::timestamp > NOW() - INTERVAL '24 hours'
ORDER BY (messages->-1->>'createdAt')::timestamp DESC;

-- 5. Check messages distribution by direction (last 50 messages total)
WITH all_messages AS (
  SELECT
    jsonb_array_elements(messages) as msg
  FROM openphone_conversations
  WHERE messages IS NOT NULL
)
SELECT
  msg->>'direction' as direction,
  COUNT(*) as count,
  MAX((msg->>'createdAt')::timestamp) as most_recent
FROM all_messages
WHERE (msg->>'createdAt')::timestamp > NOW() - INTERVAL '30 days'
GROUP BY msg->>'direction';

-- 6. Check for today's messages specifically
SELECT
  phone_number,
  customer_name,
  jsonb_array_length(messages) as total_messages,
  updated_at
FROM openphone_conversations
WHERE DATE(COALESCE(updated_at, created_at)) = CURRENT_DATE
ORDER BY COALESCE(updated_at, created_at) DESC;