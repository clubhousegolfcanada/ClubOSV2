-- Fix blacklisted_tokens table with proper UUID type
DROP TABLE IF EXISTS blacklisted_tokens CASCADE;

CREATE TABLE IF NOT EXISTS blacklisted_tokens (
  id SERIAL PRIMARY KEY,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- Fixed: UUID instead of INTEGER
  blacklisted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  reason VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_hash ON blacklisted_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_user ON blacklisted_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_expires ON blacklisted_tokens(expires_at);