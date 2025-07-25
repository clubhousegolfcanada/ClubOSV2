-- Migration: Add Slack reply tracking functionality (Tables only)
-- Created: 2025-01-01
-- Description: Creates feedback and slack_messages tables

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

-- Create slack_messages table
CREATE TABLE IF NOT EXISTS slack_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
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

-- Create indexes for feedback
CREATE INDEX IF NOT EXISTS idx_feedback_source ON feedback(feedback_source);
CREATE INDEX IF NOT EXISTS idx_feedback_slack_thread ON feedback(slack_thread_ts);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);

-- Create indexes for slack_messages
CREATE INDEX IF NOT EXISTS idx_slack_messages_user_id ON slack_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_messages_thread_ts ON slack_messages(slack_thread_ts);
CREATE INDEX IF NOT EXISTS idx_slack_messages_created_at ON slack_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slack_messages_request_id ON slack_messages(request_id);