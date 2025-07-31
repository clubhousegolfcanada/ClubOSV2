#!/bin/bash

echo "Testing OpenPhone Messages Storage"
echo "=================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Please set DATABASE_URL environment variable first"
    exit 1
fi

# Query the database
psql "$DATABASE_URL" << EOF
-- Check openphone_conversations table
SELECT 
    COUNT(*) as total_conversations,
    COUNT(CASE WHEN phone_number IS NOT NULL THEN 1 END) as with_phone,
    COUNT(CASE WHEN phone_number IS NULL THEN 1 END) as without_phone
FROM openphone_conversations;

-- Show recent conversations
SELECT 
    id,
    conversation_id,
    phone_number,
    customer_name,
    jsonb_array_length(messages) as message_count,
    created_at
FROM openphone_conversations
ORDER BY created_at DESC
LIMIT 5;

-- Check for any messages
SELECT 
    id,
    phone_number,
    jsonb_pretty(messages::jsonb -> 0) as first_message
FROM openphone_conversations
WHERE jsonb_array_length(messages) > 0
LIMIT 1;
EOF