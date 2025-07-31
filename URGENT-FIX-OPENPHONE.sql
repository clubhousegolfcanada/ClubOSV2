-- URGENT: Fix OpenPhone column types
-- Run this directly on Railway PostgreSQL to fix the issue immediately

-- 1. Fix the column types that are causing errors
ALTER TABLE openphone_conversations 
ALTER COLUMN conversation_id TYPE VARCHAR(255),
ALTER COLUMN phone_number TYPE VARCHAR(20),
ALTER COLUMN customer_name TYPE VARCHAR(255),
ALTER COLUMN employee_name TYPE VARCHAR(255);

-- 2. Verify the fix
SELECT 
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'openphone_conversations'
AND column_name IN ('conversation_id', 'phone_number', 'customer_name', 'employee_name');

-- 3. Test insert to confirm it works
INSERT INTO openphone_conversations 
(conversation_id, phone_number, customer_name, employee_name, messages, metadata)
VALUES 
('test_conv_123', '+19024783209', 'Test Customer', 'OpenPhone', '[]'::jsonb, '{}'::jsonb);

-- 4. Check if test worked
SELECT * FROM openphone_conversations WHERE conversation_id = 'test_conv_123';

-- 5. Clean up test
DELETE FROM openphone_conversations WHERE conversation_id = 'test_conv_123';