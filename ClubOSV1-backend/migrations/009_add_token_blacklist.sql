-- Migration: Add token blacklist table for logout functionality
-- Author: ClubOS Team
-- Date: 2025-01-09
-- Description: Creates a table to store blacklisted JWT tokens for server-side logout

-- Create the blacklisted_tokens table
CREATE TABLE IF NOT EXISTS blacklisted_tokens (
    id SERIAL PRIMARY KEY,
    -- Store a hash of the token for security (we don't want to store actual tokens)
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    -- User who owned this token
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    -- Session ID from the JWT payload
    session_id VARCHAR(255),
    -- When the token naturally expires (from JWT exp claim)
    expires_at TIMESTAMP NOT NULL,
    -- When the token was blacklisted
    blacklisted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Reason for blacklisting
    reason VARCHAR(50) DEFAULT 'user_logout',
    -- IP address of the request that blacklisted the token
    ip_address VARCHAR(45),
    -- User agent of the request
    user_agent TEXT
);

-- Create indexes for performance
CREATE INDEX idx_blacklisted_tokens_hash ON blacklisted_tokens(token_hash);
CREATE INDEX idx_blacklisted_tokens_expires_at ON blacklisted_tokens(expires_at);
CREATE INDEX idx_blacklisted_tokens_user_id ON blacklisted_tokens(user_id);
CREATE INDEX idx_blacklisted_tokens_session_id ON blacklisted_tokens(session_id);

-- Add a cleanup policy comment (to be implemented as a cron job)
COMMENT ON TABLE blacklisted_tokens IS 'Stores blacklisted JWT tokens for server-side logout. Entries should be cleaned up periodically after their expiration time.';

-- Create a function to clean up expired tokens (can be called by a cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_blacklisted_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM blacklisted_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment about the cleanup function
COMMENT ON FUNCTION cleanup_expired_blacklisted_tokens() IS 'Removes expired tokens from the blacklist. Should be called periodically (e.g., daily) to prevent table bloat.';