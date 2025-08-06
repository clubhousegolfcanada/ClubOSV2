-- Check what's actually in the database
SELECT 
    id,
    phone_number,
    customer_name,
    employee_name,
    jsonb_array_length(messages) as message_count,
    messages->0->>'from' as first_msg_from,
    messages->0->>'to' as first_msg_to,
    messages->0->>'text' as first_msg_text,
    created_at
FROM openphone_conversations 
ORDER BY created_at DESC 
LIMIT 20;