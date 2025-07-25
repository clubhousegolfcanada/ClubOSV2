-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id UUID,
  user_email VARCHAR(255),
  request_description TEXT NOT NULL,
  location VARCHAR(255),
  route VARCHAR(50),
  response TEXT,
  confidence DECIMAL(3,2),
  is_useful BOOLEAN NOT NULL DEFAULT false,
  feedback_type VARCHAR(50),
  feedback_source VARCHAR(50) DEFAULT 'user',
  slack_thread_ts VARCHAR(255),
  slack_user_name VARCHAR(255),
  slack_user_id VARCHAR(255),
  slack_channel VARCHAR(255),
  original_request_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);