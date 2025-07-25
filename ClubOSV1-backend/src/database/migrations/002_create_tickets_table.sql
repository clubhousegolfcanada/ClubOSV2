-- Migration: Create tickets table
-- Created: 2025-01-25
-- Description: Creates tickets table for persistent ticket storage

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('facilities', 'tech')),
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
  priority VARCHAR(50) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  location VARCHAR(255),
  
  -- Created by user info
  created_by_id UUID NOT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  created_by_email VARCHAR(255) NOT NULL,
  created_by_phone VARCHAR(50),
  
  -- Assigned to user info (nullable)
  assigned_to_id UUID,
  assigned_to_name VARCHAR(255),
  assigned_to_email VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create ticket_comments table
CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  
  -- Created by user info
  created_by_id UUID NOT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  created_by_email VARCHAR(255) NOT NULL,
  created_by_phone VARCHAR(50),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for tickets
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by_id ON tickets(created_by_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_id ON tickets(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);

-- Create indexes for comments
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON ticket_comments(created_at DESC);

-- Create view for tickets with comment count
CREATE OR REPLACE VIEW tickets_with_counts AS
SELECT 
  t.*,
  COUNT(tc.id) as comment_count
FROM tickets t
LEFT JOIN ticket_comments tc ON t.id = tc.ticket_id
GROUP BY t.id;
