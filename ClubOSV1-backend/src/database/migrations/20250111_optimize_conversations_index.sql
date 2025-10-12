-- Migration: Optimize OpenPhone Conversations Index
-- Date: 2025-01-11
-- Purpose: Add index to improve DISTINCT ON query performance for messages page

-- Create index on phone_number and updated_at for faster DISTINCT ON queries
-- This will significantly improve the performance of the conversations list query
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_phone_updated
ON openphone_conversations(phone_number, updated_at DESC)
WHERE phone_number IS NOT NULL
  AND phone_number != ''
  AND phone_number != 'Unknown';

-- Also create an index on created_at for fallback when updated_at doesn't exist
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_phone_created
ON openphone_conversations(phone_number, created_at DESC)
WHERE phone_number IS NOT NULL
  AND phone_number != ''
  AND phone_number != 'Unknown';

-- Add index on unread_count for faster filtering of unread messages
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_unread
ON openphone_conversations(unread_count)
WHERE unread_count > 0;