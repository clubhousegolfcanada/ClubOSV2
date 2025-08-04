-- Fix ticket_comments index to use the correct column name
-- This handles the case where the column might be created_at or createdAt

DO $$
BEGIN
    -- First check if the table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'ticket_comments'
    ) THEN
        -- Table doesn't exist, skip index creation
        RETURN;
    END IF;

    -- Drop any existing indexes first to avoid conflicts
    DROP INDEX IF EXISTS idx_ticket_comments_created_at;
    DROP INDEX IF EXISTS idx_ticket_comments_createdAt;
    
    -- Check what column actually exists and create appropriate index
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_comments' 
        AND column_name = 'created_at'
    ) THEN
        -- Column is snake_case, create index with that
        CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON ticket_comments(created_at DESC);
    ELSEIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_comments' 
        AND column_name = 'createdAt'
    ) THEN
        -- Column is camelCase, create index with that
        CREATE INDEX IF NOT EXISTS idx_ticket_comments_createdAt ON ticket_comments("createdAt" DESC);
    ELSE
        -- Neither column exists, log a notice but don't fail
        RAISE NOTICE 'No created_at or createdAt column found in ticket_comments table';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the migration
        RAISE NOTICE 'Error creating ticket_comments index: %', SQLERRM;
END $$;