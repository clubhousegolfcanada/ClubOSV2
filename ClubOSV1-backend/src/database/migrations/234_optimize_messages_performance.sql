-- Migration 234: Optimize messages performance
-- Fix for 5-10 second loading times

-- Ensure we have the right indexes for the messages query
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_phone_number_btree
ON openphone_conversations(phone_number)
WHERE phone_number IS NOT NULL AND phone_number != '' AND phone_number != 'Unknown';

CREATE INDEX IF NOT EXISTS idx_openphone_conversations_updated_desc_btree
ON openphone_conversations(updated_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_openphone_conversations_created_desc_btree
ON openphone_conversations(created_at DESC);

-- Composite index for DISTINCT ON query optimization
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_phone_updated
ON openphone_conversations(phone_number, updated_at DESC)
WHERE phone_number IS NOT NULL AND phone_number != '' AND phone_number != 'Unknown';

-- Add customer_name column index for better search performance
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_customer_name
ON openphone_conversations(customer_name);

-- Analyze the table to update statistics for query planner
ANALYZE openphone_conversations;