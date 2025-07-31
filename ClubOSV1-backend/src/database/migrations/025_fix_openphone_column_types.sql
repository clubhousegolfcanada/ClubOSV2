-- Migration: Fix OpenPhone column types
-- Created: 2025-07-31
-- Description: Fix column types that are causing "value too long for type character(1)" error

-- Check and fix column types in openphone_conversations table
DO $$ 
BEGIN
    -- Fix conversation_id if it's CHAR(1)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'openphone_conversations' 
        AND column_name = 'conversation_id' 
        AND character_maximum_length = 1
    ) THEN
        ALTER TABLE openphone_conversations 
        ALTER COLUMN conversation_id TYPE VARCHAR(255);
        RAISE NOTICE 'Fixed conversation_id column type';
    END IF;

    -- Fix phone_number if it's CHAR(1)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'openphone_conversations' 
        AND column_name = 'phone_number' 
        AND character_maximum_length = 1
    ) THEN
        ALTER TABLE openphone_conversations 
        ALTER COLUMN phone_number TYPE VARCHAR(20);
        RAISE NOTICE 'Fixed phone_number column type';
    END IF;

    -- Fix customer_name if it's CHAR(1)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'openphone_conversations' 
        AND column_name = 'customer_name' 
        AND character_maximum_length = 1
    ) THEN
        ALTER TABLE openphone_conversations 
        ALTER COLUMN customer_name TYPE VARCHAR(255);
        RAISE NOTICE 'Fixed customer_name column type';
    END IF;

    -- Fix employee_name if it's CHAR(1)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'openphone_conversations' 
        AND column_name = 'employee_name' 
        AND character_maximum_length = 1
    ) THEN
        ALTER TABLE openphone_conversations 
        ALTER COLUMN employee_name TYPE VARCHAR(255);
        RAISE NOTICE 'Fixed employee_name column type';
    END IF;
END $$;

-- Verify column types
SELECT 
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'openphone_conversations'
AND column_name IN ('conversation_id', 'phone_number', 'customer_name', 'employee_name')
ORDER BY column_name;