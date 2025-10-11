-- Migration: Create ticket_comments table and fix archived status
-- Purpose: Fix ticket commenting system and archive functionality
-- Date: 2025-10-11

-- First, update the tickets table status constraint if needed
ALTER TABLE tickets
DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE tickets
ADD CONSTRAINT tickets_status_check
CHECK (status IN ('open', 'in-progress', 'resolved', 'closed', 'archived'));

-- Add archived columns if they don't exist
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS archived_by UUID;

-- Create ticket_comments table
CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_by_id UUID NOT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  created_by_email VARCHAR(255) NOT NULL,
  created_by_phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON ticket_comments(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_archived_at ON tickets(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_location ON tickets(location);

-- Add trigger to update updated_at on ticket_comments
CREATE OR REPLACE FUNCTION update_ticket_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ticket_comments_updated_at
BEFORE UPDATE ON ticket_comments
FOR EACH ROW
EXECUTE FUNCTION update_ticket_comments_updated_at();