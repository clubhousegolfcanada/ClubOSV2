-- Migration: Add token metrics tracking for monitoring auth improvements
-- Version: 224
-- Description: Track token usage and refresh patterns

-- UP
CREATE TABLE IF NOT EXISTS token_metrics (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50),
  action VARCHAR(50), -- 'issued', 'refreshed', 'expired', 'revoked'
  token_lifetime_days INTEGER,
  client_info JSONB, -- user agent, IP, etc
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_metrics_user ON token_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_token_metrics_created ON token_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_token_metrics_action ON token_metrics(action);

-- Add comment
COMMENT ON TABLE token_metrics IS 'Tracks token issuance and refresh patterns for auth monitoring';

-- DOWN
DROP TABLE IF EXISTS token_metrics;