-- Migration: Add slack_replies table and view for Phase 2
-- Created: 2025-01-27
-- Description: Creates slack_replies table and slack_replies_view for Slack reply tracking

-- Create slack_replies table
CREATE TABLE IF NOT EXISTS slack_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_ts VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),
  user_id VARCHAR(255) NOT NULL,
  text TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key to slack_messages table
  CONSTRAINT fk_slack_replies_thread_ts 
    FOREIGN KEY (thread_ts) 
    REFERENCES slack_messages(slack_thread_ts) 
    ON DELETE CASCADE
);

-- Create indexes for slack_replies
CREATE INDEX IF NOT EXISTS idx_slack_replies_thread_ts ON slack_replies(thread_ts);
CREATE INDEX IF NOT EXISTS idx_slack_replies_user_id ON slack_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_replies_timestamp ON slack_replies(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_slack_replies_created_at ON slack_replies(created_at DESC);

-- Create slack_replies_view for easy querying with original message context
CREATE OR REPLACE VIEW slack_replies_view AS
SELECT 
  sr.id as reply_id,
  sr.thread_ts,
  sr.user_name as reply_user_name,
  sr.user_id as reply_user_id,
  sr.text as reply_text,
  sr.timestamp as reply_timestamp,
  sr.created_at as reply_created_at,
  
  -- Original message details
  sm.id as original_message_id,
  sm.user_id as original_user_id,
  sm.request_id as original_request_id,
  sm.slack_channel,
  sm.request_description,
  sm.location,
  sm.route,
  sm.created_at as original_created_at
  
FROM slack_replies sr
JOIN slack_messages sm ON sr.thread_ts = sm.slack_thread_ts
ORDER BY sr.timestamp DESC;