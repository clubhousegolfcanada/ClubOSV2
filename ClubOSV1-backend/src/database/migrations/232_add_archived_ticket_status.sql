-- Migration: Add 'archived' status to tickets table
-- Purpose: Allow soft-delete of tickets by archiving instead of hard deletion
-- Date: 2025-01-24

-- First, drop the existing constraint
ALTER TABLE tickets
DROP CONSTRAINT IF EXISTS valid_status;

-- Add the new constraint with 'archived' included
ALTER TABLE tickets
ADD CONSTRAINT valid_status
CHECK (status IN ('open', 'in-progress', 'resolved', 'closed', 'archived'));

-- Add an index for archived tickets for better query performance
CREATE INDEX IF NOT EXISTS idx_tickets_status_archived
ON tickets(status)
WHERE status = 'archived';

-- Add archived_at column to track when tickets were archived
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

-- Add archived_by column to track who archived the ticket
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users(id);

-- Create index for archived_at for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_tickets_archived_at
ON tickets(archived_at)
WHERE archived_at IS NOT NULL;