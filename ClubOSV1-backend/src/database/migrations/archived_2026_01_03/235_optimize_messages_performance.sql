-- =====================================================
-- Migration: Optimize Messages Performance
-- Purpose: Add optimized indexes for messaging queries
-- Date: 2025-10-23
-- =====================================================

-- Drop redundant indexes that overlap with our new composite index
DROP INDEX IF EXISTS idx_openphone_phone_number;
DROP INDEX IF EXISTS idx_openphone_updated_at;

-- Create optimized composite index for the main conversation query
-- This index perfectly matches the DISTINCT ON (phone_number) ... ORDER BY phone_number, updated_at DESC pattern
CREATE INDEX IF NOT EXISTS idx_openphone_phone_updated_composite
ON openphone_conversations(phone_number, updated_at DESC NULLS LAST)
WHERE phone_number IS NOT NULL
  AND phone_number != ''
  AND phone_number != 'Unknown';

-- Create covering index for unread count queries
CREATE INDEX IF NOT EXISTS idx_openphone_unread_phone
ON openphone_conversations(phone_number, unread_count)
WHERE unread_count > 0;

-- Create index for search queries (customer name search)
CREATE INDEX IF NOT EXISTS idx_openphone_customer_name_trgm
ON openphone_conversations
USING gin(customer_name gin_trgm_ops);

-- Enable trigram extension if not already enabled (for fuzzy search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Analyze the table to update statistics for query planner
ANALYZE openphone_conversations;

-- Add partial index for active conversations (last 30 days)
CREATE INDEX IF NOT EXISTS idx_openphone_recent_conversations
ON openphone_conversations(updated_at DESC)
WHERE updated_at > (CURRENT_DATE - INTERVAL '30 days');

-- Create index for pagination with created_at fallback
CREATE INDEX IF NOT EXISTS idx_openphone_created_at_desc
ON openphone_conversations(created_at DESC)
WHERE created_at IS NOT NULL;

-- Add comment to track migration purpose
COMMENT ON INDEX idx_openphone_phone_updated_composite IS 'Primary composite index for conversation list queries - matches DISTINCT ON pattern';
COMMENT ON INDEX idx_openphone_unread_phone IS 'Optimized for unread count queries';
COMMENT ON INDEX idx_openphone_recent_conversations IS 'Partial index for recent conversations to speed up common queries';