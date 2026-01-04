-- Migration: Add blacklisted_tokens table for JWT token blacklisting
-- This table stores revoked/blacklisted JWT tokens to prevent reuse after logout
-- Date: 2025-09-03

-- UP
CREATE TABLE IF NOT EXISTS blacklisted_tokens (
    id SERIAL PRIMARY KEY,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    blacklisted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reason VARCHAR(100) -- 'logout', 'password_change', 'admin_revoke', etc.
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_hash ON blacklisted_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_expires ON blacklisted_tokens(expires_at);

-- Add a cleanup job comment (to be run periodically)
COMMENT ON TABLE blacklisted_tokens IS 'Stores blacklisted JWT tokens. Run periodic cleanup: DELETE FROM blacklisted_tokens WHERE expires_at < NOW()';

-- DOWN
DROP TABLE IF EXISTS blacklisted_tokens;