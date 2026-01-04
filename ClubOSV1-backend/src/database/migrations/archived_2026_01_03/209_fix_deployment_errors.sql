-- Migration: Fix deployment errors
-- Created: 2025-09-05
-- Purpose: Fix blacklisted_tokens table and missing cleanup function

-- Drop the incorrectly created table if it exists
DROP TABLE IF EXISTS blacklisted_tokens CASCADE;

-- Create blacklisted_tokens table with correct UUID type
CREATE TABLE IF NOT EXISTS blacklisted_tokens (
  id SERIAL PRIMARY KEY,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  blacklisted_at TIMESTAMP DEFAULT NOW(),
  reason VARCHAR(100),
  expires_at TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_hash ON blacklisted_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_expires ON blacklisted_tokens(expires_at);

-- Create the cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_blacklisted_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM blacklisted_tokens 
  WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON TABLE blacklisted_tokens IS 'Stores invalidated JWT tokens for security';
COMMENT ON FUNCTION cleanup_expired_blacklisted_tokens() IS 'Removes expired tokens from blacklist';