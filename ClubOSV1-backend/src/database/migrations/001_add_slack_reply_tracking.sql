-- Migration: Add Slack reply tracking functionality
-- Created: 2025-01-01
-- Description: Extends feedback system to track Slack messages and replies

-- First, let's check if the feedback table exists and create it if it doesn't
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP NOT NULL,
  user_id UUID REFERENCES users(id),
  user_email VARCHAR(255),
  request_description TEXT NOT NULL,
  location VARCHAR(255),
  route VARCHAR(50),
  response TEXT,
  confidence DECIMAL(3,2),
  is_useful BOOLEAN NOT NULL,
  feedback_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns to feedback table for Slack integration
ALTER TABLE feedback 
ADD COLUMN IF NOT EXISTS feedback_source VARCHAR(50) DEFAULT 'user',
ADD COLUMN IF NOT EXISTS slack_thread_ts VARCHAR(255),
ADD COLUMN IF NOT EXISTS slack_user_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS slack_user_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS slack_channel VARCHAR(255),
ADD COLUMN IF NOT EXISTS original_request_id UUID;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_feedback_source ON feedback(feedback_source);
CREATE INDEX IF NOT EXISTS idx_feedback_slack_thread ON feedback(slack_thread_ts);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);

-- Create table for tracking Slack messages sent from ClubOS
CREATE TABLE IF NOT EXISTS slack_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  request_id UUID,
  slack_thread_ts VARCHAR(255) UNIQUE,
  slack_channel VARCHAR(255) NOT NULL,
  slack_message_ts VARCHAR(255),
  original_message TEXT NOT NULL,
  request_description TEXT,
  location VARCHAR(255),
  route VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for slack_messages table
CREATE INDEX IF NOT EXISTS idx_slack_messages_user_id ON slack_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_messages_thread_ts ON slack_messages(slack_thread_ts);
CREATE INDEX IF NOT EXISTS idx_slack_messages_created_at ON slack_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slack_messages_request_id ON slack_messages(request_id);

-- Create a view for easy querying of Slack replies
CREATE OR REPLACE VIEW slack_replies_view AS
SELECT 
  f.id,
  f.timestamp,
  f.slack_user_name,
  f.slack_user_id,
  f.response as slack_reply,
  f.slack_channel,
  f.slack_thread_ts,
  sm.request_description,
  sm.location,
  sm.route,
  sm.user_id as original_user_id,
  sm.created_at as original_message_time,
  f.created_at as reply_time
FROM feedback f
JOIN slack_messages sm ON f.slack_thread_ts = sm.slack_thread_ts
WHERE f.feedback_source = 'slack_reply'
ORDER BY f.created_at DESC;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_slack_messages_updated_at 
  BEFORE UPDATE ON slack_messages 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE slack_messages IS 'Tracks all messages sent to Slack from ClubOS for reply tracking';
COMMENT ON COLUMN slack_messages.slack_thread_ts IS 'Slack thread timestamp - unique identifier for a thread';
COMMENT ON COLUMN slack_messages.slack_message_ts IS 'Timestamp of the actual message sent';
COMMENT ON COLUMN feedback.feedback_source IS 'Source of feedback: user, slack_reply, system';
COMMENT ON COLUMN feedback.slack_thread_ts IS 'Links to slack_messages table for reply tracking';