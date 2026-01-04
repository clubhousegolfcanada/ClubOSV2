-- Migration: Operator Actions and Import Tracking
-- Purpose: Track operator responses to pattern suggestions and CSV import history
-- Date: 2025-09-03

-- Table for tracking operator actions on pattern suggestions
CREATE TABLE IF NOT EXISTS operator_actions (
  id SERIAL PRIMARY KEY,
  suggestion_id INTEGER,
  operator_id UUID REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('accept', 'modify', 'reject')),
  original_suggestion TEXT,
  final_response TEXT,
  pattern_id INTEGER REFERENCES decision_patterns(id),
  conversation_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add missing columns to pattern_suggestions_queue if they don't exist
ALTER TABLE pattern_suggestions_queue 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS final_response TEXT;

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_pattern_suggestions_status 
ON pattern_suggestions_queue(status, created_at DESC);

-- Table for tracking CSV import jobs
CREATE TABLE IF NOT EXISTS pattern_import_jobs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'processing',
  total_messages INTEGER DEFAULT 0,
  processed_messages INTEGER DEFAULT 0,
  duplicate_messages INTEGER DEFAULT 0,
  conversations_found INTEGER DEFAULT 0,
  conversations_analyzed INTEGER DEFAULT 0,
  patterns_created INTEGER DEFAULT 0,
  patterns_enhanced INTEGER DEFAULT 0,
  file_hash VARCHAR(64),
  import_metadata JSONB,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT
);

-- Table for tracking imported messages to prevent duplicates
CREATE TABLE IF NOT EXISTS imported_messages (
  id SERIAL PRIMARY KEY,
  message_id VARCHAR(255) UNIQUE,
  message_hash VARCHAR(64),
  phone_number VARCHAR(50),
  direction VARCHAR(20),
  sent_at TIMESTAMP,
  import_job_id INTEGER REFERENCES pattern_import_jobs(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for duplicate checking
CREATE INDEX IF NOT EXISTS idx_imported_messages_hash 
ON imported_messages(message_hash);

-- Create index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_imported_messages_phone 
ON imported_messages(phone_number);

-- Add execution_status column to pattern_execution_history if missing
ALTER TABLE pattern_execution_history
ADD COLUMN IF NOT EXISTS execution_status VARCHAR(50) DEFAULT 'completed';

-- Create index for recent activity queries
CREATE INDEX IF NOT EXISTS idx_pattern_execution_recent 
ON pattern_execution_history(created_at DESC, pattern_id);

-- Add template_variables column to decision_patterns if missing
ALTER TABLE decision_patterns
ADD COLUMN IF NOT EXISTS template_variables JSONB,
ADD COLUMN IF NOT EXISTS learned_from VARCHAR(100);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON operator_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON pattern_import_jobs TO authenticated;
GRANT SELECT, INSERT ON imported_messages TO authenticated;