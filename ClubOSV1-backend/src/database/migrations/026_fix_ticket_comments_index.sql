-- Fix ticket_comments index to use the correct column name
-- This handles the case where the column might be created_at or createdAt

DO $$
BEGIN
    -- First check what column actually exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_comments' 
        AND column_name = 'created_at'
    ) THEN
        -- Column is snake_case, create index with that
        DROP INDEX IF EXISTS idx_ticket_comments_created_at;
        DROP INDEX IF EXISTS idx_ticket_comments_createdAt;
        CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON ticket_comments(created_at DESC);
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_comments' 
        AND column_name = 'createdAt'
    ) THEN
        -- Column is camelCase, create index with that
        DROP INDEX IF EXISTS idx_ticket_comments_created_at;
        DROP INDEX IF EXISTS idx_ticket_comments_createdAt;
        CREATE INDEX IF NOT EXISTS idx_ticket_comments_createdAt ON ticket_comments("createdAt" DESC);
    END IF;
END $$;