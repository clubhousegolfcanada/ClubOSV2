-- Migration: Add archived_at column to tickets table
-- Created: 2025-10-21
-- Purpose: Fix missing archived_at column that's causing index creation failure

-- Add archived_at column if it doesn't exist
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN tickets.archived_at IS 'Timestamp when ticket was archived/soft-deleted';

-- Create index for faster queries on non-archived tickets
CREATE INDEX IF NOT EXISTS idx_tickets_archived_at
ON tickets(archived_at)
WHERE archived_at IS NOT NULL;

-- Create index for active tickets (most common query)
CREATE INDEX IF NOT EXISTS idx_tickets_active
ON tickets(created_at DESC)
WHERE archived_at IS NULL;

-- Update any existing tickets to ensure consistency
UPDATE tickets
SET archived_at = NULL
WHERE archived_at IS NOT NULL
  AND status IN ('open', 'in_progress', 'pending');