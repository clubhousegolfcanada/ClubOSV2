-- Add email verification system
-- This migration creates a table for tracking email verification tokens

-- Create email verification tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_active_token_per_user UNIQUE (user_id, used_at)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires ON email_verification_tokens(expires_at) WHERE used_at IS NULL;

-- Add email_verified column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users'
                AND column_name = 'email_verified') THEN
    ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add email_verified_at column to track when verification occurred
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users'
                AND column_name = 'email_verified_at') THEN
    ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP;
  END IF;
END $$;

-- Update existing users to be verified (they signed up before verification was added)
UPDATE users SET email_verified = true, email_verified_at = created_at
WHERE email_verified IS NULL OR email_verified = false;

-- Create function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_verification_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM email_verification_tokens
  WHERE expires_at < CURRENT_TIMESTAMP
  AND used_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a periodic cleanup (would need pg_cron extension)
-- SELECT cron.schedule('cleanup-expired-tokens', '0 * * * *', 'SELECT cleanup_expired_verification_tokens();');

COMMENT ON TABLE email_verification_tokens IS 'Stores email verification tokens for new user registrations';
COMMENT ON COLUMN email_verification_tokens.used_at IS 'Timestamp when token was used, NULL if still active';