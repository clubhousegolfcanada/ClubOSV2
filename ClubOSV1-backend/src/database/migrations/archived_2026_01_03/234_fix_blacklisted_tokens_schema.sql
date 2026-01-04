-- Migration: Fix blacklisted_tokens table schema
-- This adds missing columns that the logout code expects but were not in the original schema
-- Fixes silent logout failures that were leaving tokens in blacklist

-- Add missing columns to blacklisted_tokens table
ALTER TABLE blacklisted_tokens
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50),
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Create index on session_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_session_id
ON blacklisted_tokens(session_id)
WHERE session_id IS NOT NULL;

-- Clean up expired blacklisted tokens (older than their expiration date)
DELETE FROM blacklisted_tokens
WHERE expires_at < NOW();

-- Clear any blacklisted tokens for mike@clubhouse247golf.com to resolve immediate access issues
DELETE FROM blacklisted_tokens
WHERE user_id = (
    SELECT id FROM users
    WHERE email = 'mike@clubhouse247golf.com'
);

-- Ensure mike@clubhouse247golf.com has admin role
UPDATE users
SET role = 'admin',
    status = 'active',
    email_verified = true
WHERE email = 'mike@clubhouse247golf.com'
AND role != 'admin';

-- Log the cleanup for audit purposes
INSERT INTO system_logs (level, message, context, created_at)
VALUES (
    'info',
    'Fixed blacklisted_tokens schema and cleared tokens for mike@clubhouse247golf.com',
    jsonb_build_object(
        'migration', '234_fix_blacklisted_tokens_schema',
        'tokens_cleaned', (SELECT COUNT(*) FROM blacklisted_tokens WHERE expires_at < NOW()),
        'user_email', 'mike@clubhouse247golf.com'
    ),
    NOW()
);