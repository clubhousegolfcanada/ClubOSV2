-- Migration: API Usage Tracking for Cost Monitoring
-- Purpose: Track API usage, costs, and performance metrics for mass use readiness

-- UP
CREATE TABLE IF NOT EXISTS api_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10),
  model VARCHAR(50),
  tokens_used INTEGER,
  cost DECIMAL(10, 6),
  response_time_ms INTEGER,
  cache_hit BOOLEAN DEFAULT false,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_model ON api_usage(model);
CREATE INDEX IF NOT EXISTS idx_api_usage_cache_hit ON api_usage(cache_hit);

-- Daily aggregation table for faster reporting
CREATE TABLE IF NOT EXISTS api_usage_daily (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  user_id INTEGER REFERENCES users(id),
  endpoint VARCHAR(255),
  model VARCHAR(50),
  total_requests INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost DECIMAL(10, 4) DEFAULT 0,
  avg_response_time_ms INTEGER,
  cache_hits INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_daily_usage UNIQUE (date, user_id, endpoint, model)
);

-- Indexes for daily aggregation
CREATE INDEX IF NOT EXISTS idx_api_usage_daily_date ON api_usage_daily(date);
CREATE INDEX IF NOT EXISTS idx_api_usage_daily_user ON api_usage_daily(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_daily_date_user ON api_usage_daily(date, user_id);

-- User rate limits table
CREATE TABLE IF NOT EXISTS user_rate_limits (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  hourly_limit INTEGER DEFAULT 100,
  daily_limit INTEGER DEFAULT 1000,
  monthly_limit INTEGER DEFAULT 10000,
  monthly_cost_limit DECIMAL(10, 2) DEFAULT 100.00,
  custom_limits JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System-wide usage alerts
CREATE TABLE IF NOT EXISTS usage_alerts (
  id SERIAL PRIMARY KEY,
  alert_type VARCHAR(50) NOT NULL, -- 'cost_threshold', 'rate_limit', 'error_rate'
  threshold_value DECIMAL(10, 2),
  current_value DECIMAL(10, 2),
  user_id INTEGER REFERENCES users(id),
  message TEXT,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_api_usage_daily_updated_at 
  BEFORE UPDATE ON api_usage_daily 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_rate_limits_updated_at 
  BEFORE UPDATE ON user_rate_limits 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- DOWN
DROP TABLE IF EXISTS usage_alerts CASCADE;
DROP TABLE IF EXISTS user_rate_limits CASCADE;
DROP TABLE IF EXISTS api_usage_daily CASCADE;
DROP TABLE IF EXISTS api_usage CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;