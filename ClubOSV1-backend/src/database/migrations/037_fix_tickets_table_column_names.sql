-- Fix tickets table to handle camelCase column names
-- The hardcoded migrations rename created_at to createdAt, but the original migration uses created_at

-- First, check if the table exists and has the correct columns
DO $$ 
BEGIN
    -- Check if tickets table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tickets') THEN
        -- Check if we have snake_case columns and rename them
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'created_at') THEN
            ALTER TABLE tickets RENAME COLUMN created_at TO "createdAt";
        END IF;
        
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'updated_at') THEN
            ALTER TABLE tickets RENAME COLUMN updated_at TO "updatedAt";
        END IF;
        
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'resolved_at') THEN
            ALTER TABLE tickets RENAME COLUMN resolved_at TO "resolvedAt";
        END IF;
    END IF;
    
    -- Same for ticket_comments
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ticket_comments') THEN
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ticket_comments' AND column_name = 'created_at') THEN
            ALTER TABLE ticket_comments RENAME COLUMN created_at TO "createdAt";
        END IF;
    END IF;
END $$;

-- Drop existing indexes that reference old column names
DROP INDEX IF EXISTS idx_tickets_created_at;
DROP INDEX IF EXISTS idx_ticket_comments_created_at;

-- Recreate indexes with correct column names
CREATE INDEX IF NOT EXISTS idx_tickets_createdAt ON tickets("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_createdAt ON ticket_comments("createdAt" DESC);

-- Recreate the view with correct column names
DROP VIEW IF EXISTS tickets_with_counts;
CREATE OR REPLACE VIEW tickets_with_counts AS
SELECT 
  t.*,
  COUNT(tc.id) as comment_count
FROM tickets t
LEFT JOIN ticket_comments tc ON t.id = tc.ticket_id
GROUP BY t.id;