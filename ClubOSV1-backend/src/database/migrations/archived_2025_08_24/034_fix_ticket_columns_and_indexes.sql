-- Fix ticket tables column naming and indexes
-- This migration handles all possible states of the ticket tables columns

DO $$
DECLARE
    v_tickets_timestamp_col TEXT;
    v_comments_timestamp_col TEXT;
BEGIN
    -- First, let's see what columns actually exist in production
    -- Check tickets table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') THEN
        -- Find which timestamp column exists
        SELECT column_name INTO v_tickets_timestamp_col
        FROM information_schema.columns 
        WHERE table_name = 'tickets' 
        AND column_name IN ('createdAt', 'created_at')
        LIMIT 1;
        
        IF v_tickets_timestamp_col IS NOT NULL THEN
            -- Drop any existing indexes
            DROP INDEX IF EXISTS idx_tickets_created_at;
            DROP INDEX IF EXISTS idx_tickets_createdAt;
            
            -- Create index based on actual column name
            IF v_tickets_timestamp_col = 'createdAt' THEN
                CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets("createdAt" DESC);
                RAISE NOTICE 'Created index on tickets.createdAt';
            ELSE
                CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
                RAISE NOTICE 'Created index on tickets.created_at';
            END IF;
        ELSE
            RAISE NOTICE 'No timestamp column found in tickets table';
        END IF;
    END IF;

    -- Check ticket_comments table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_comments') THEN
        -- Find which timestamp column exists
        SELECT column_name INTO v_comments_timestamp_col
        FROM information_schema.columns 
        WHERE table_name = 'ticket_comments' 
        AND column_name IN ('createdAt', 'created_at')
        LIMIT 1;
        
        IF v_comments_timestamp_col IS NOT NULL THEN
            -- Drop any existing indexes
            DROP INDEX IF EXISTS idx_ticket_comments_created_at;
            DROP INDEX IF EXISTS idx_ticket_comments_createdAt;
            
            -- Create index based on actual column name
            IF v_comments_timestamp_col = 'createdAt' THEN
                CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON ticket_comments("createdAt" DESC);
                RAISE NOTICE 'Created index on ticket_comments.createdAt';
            ELSE
                CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON ticket_comments(created_at DESC);
                RAISE NOTICE 'Created index on ticket_comments.created_at';
            END IF;
        ELSE
            -- No timestamp column exists, add one
            RAISE NOTICE 'No timestamp column found in ticket_comments, adding created_at';
            ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON ticket_comments(created_at DESC);
        END IF;
    END IF;

    -- Log what we found
    RAISE NOTICE 'Tickets timestamp column: %', COALESCE(v_tickets_timestamp_col, 'none');
    RAISE NOTICE 'Comments timestamp column: %', COALESCE(v_comments_timestamp_col, 'none');

EXCEPTION
    WHEN OTHERS THEN
        -- Log but don't fail
        RAISE WARNING 'Error in ticket column/index migration: %', SQLERRM;
END $$;

-- Ensure other important indexes exist (with safety checks)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') THEN
        CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
        CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
        CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_comments') THEN
        CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error creating supplementary indexes: %', SQLERRM;
END $$;