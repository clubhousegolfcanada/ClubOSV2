-- Migration: Add Google OAuth Support
-- Description: Adds fields to support Google Sign-In alongside existing password authentication
-- Author: ClubOS Team
-- Date: 2025-09-27

-- Add OAuth-related columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'local' CHECK (auth_provider IN ('local', 'google', 'microsoft')),
ADD COLUMN IF NOT EXISTS oauth_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS oauth_picture_url TEXT,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS oauth_metadata JSONB;

-- Create index for faster Google ID lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

-- Create index for auth_provider to optimize queries by authentication type
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);

-- Create index for OAuth email (for linking accounts)
CREATE INDEX IF NOT EXISTS idx_users_oauth_email ON users(oauth_email) WHERE oauth_email IS NOT NULL;

-- Update password to be nullable for OAuth users (they don't have passwords)
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Add constraint to ensure local users have passwords
ALTER TABLE users ADD CONSTRAINT check_local_has_password
CHECK (auth_provider != 'local' OR password IS NOT NULL);

-- Create OAuth sessions table for managing OAuth tokens and refresh tokens
CREATE TABLE IF NOT EXISTS oauth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for OAuth sessions
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_user_id ON oauth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_provider ON oauth_sessions(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires ON oauth_sessions(token_expires_at) WHERE token_expires_at IS NOT NULL;

-- Create audit log for OAuth sign-ins
CREATE TABLE IF NOT EXISTS oauth_login_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    provider VARCHAR(20) NOT NULL,
    google_id VARCHAR(255),
    success BOOLEAN NOT NULL,
    failure_reason TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_oauth_login_audit_user_id ON oauth_login_audit(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oauth_login_audit_email ON oauth_login_audit(email);
CREATE INDEX IF NOT EXISTS idx_oauth_login_audit_created_at ON oauth_login_audit(created_at);

-- Add comment for documentation
COMMENT ON COLUMN users.google_id IS 'Google OAuth unique identifier (sub claim from Google ID token)';
COMMENT ON COLUMN users.auth_provider IS 'Authentication provider: local (password), google, or microsoft';
COMMENT ON COLUMN users.oauth_email IS 'Email from OAuth provider (may differ from primary email)';
COMMENT ON COLUMN users.oauth_picture_url IS 'Profile picture URL from OAuth provider';
COMMENT ON COLUMN users.email_verified IS 'Whether email has been verified by OAuth provider';
COMMENT ON COLUMN users.oauth_metadata IS 'Additional OAuth provider data (locale, hd domain for Google Workspace, etc)';

-- Grant permissions (adjust based on your database user setup)
-- GRANT ALL ON oauth_sessions TO clubos_app;
-- GRANT ALL ON oauth_login_audit TO clubos_app;