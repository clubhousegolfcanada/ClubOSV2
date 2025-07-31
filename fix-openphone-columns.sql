-- Quick fix for OpenPhone column types
-- Run this directly on the database to fix the immediate issue

-- Fix all potentially problematic columns
ALTER TABLE openphone_conversations 
ALTER COLUMN conversation_id TYPE VARCHAR(255),
ALTER COLUMN phone_number TYPE VARCHAR(20),
ALTER COLUMN customer_name TYPE VARCHAR(255),
ALTER COLUMN employee_name TYPE VARCHAR(255);

-- Verify the changes
SELECT 
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'openphone_conversations'
ORDER BY ordinal_position;