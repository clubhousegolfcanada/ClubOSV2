-- Fix ticket_comments index to use the correct column name
-- Drop any existing indexes first to avoid conflicts
DROP INDEX IF EXISTS idx_ticket_comments_created_at;
DROP INDEX IF EXISTS idx_ticket_comments_createdAt;

-- Try to create index with snake_case naming (will fail silently if column doesn't exist)
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON ticket_comments(created_at DESC);