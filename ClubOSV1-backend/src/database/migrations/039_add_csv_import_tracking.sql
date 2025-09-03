-- Migration: Add CSV import tracking and deduplication
-- Created: 2025-09-03
-- Description: Track imported messages to prevent duplicates and show import history

-- Table to track import jobs
CREATE TABLE IF NOT EXISTS pattern_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_messages INTEGER DEFAULT 0,
  processed_messages INTEGER DEFAULT 0,
  duplicate_messages INTEGER DEFAULT 0,
  conversations_found INTEGER DEFAULT 0,
  conversations_analyzed INTEGER DEFAULT 0,
  patterns_created INTEGER DEFAULT 0,
  patterns_enhanced INTEGER DEFAULT 0,
  patterns_skipped INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  file_hash VARCHAR(64), -- SHA256 hash of the CSV file
  import_metadata JSONB DEFAULT '{}' -- Store date ranges, phone numbers, etc.
);

-- Table to track individual imported messages (for deduplication)
CREATE TABLE IF NOT EXISTS imported_messages (
  id SERIAL PRIMARY KEY,
  message_id VARCHAR(255) UNIQUE, -- OpenPhone message ID
  message_hash VARCHAR(64) NOT NULL, -- SHA256 hash of message content
  phone_number VARCHAR(20),
  direction VARCHAR(10),
  sent_at TIMESTAMP,
  import_job_id UUID REFERENCES pattern_import_jobs(id),
  imported_at TIMESTAMP DEFAULT NOW(),
  
  -- Create index for fast duplicate checking
  INDEX idx_message_hash (message_hash),
  INDEX idx_message_id (message_id),
  INDEX idx_phone_sent (phone_number, sent_at)
);

-- Table to track which patterns came from which messages
CREATE TABLE IF NOT EXISTS pattern_message_sources (
  pattern_id INTEGER REFERENCES decision_patterns(id),
  message_id VARCHAR(255) REFERENCES imported_messages(message_id),
  import_job_id UUID REFERENCES pattern_import_jobs(id),
  confidence_contribution DECIMAL(3,2), -- How much this message contributed to pattern confidence
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (pattern_id, message_id)
);

-- Add columns to decision_patterns for better tracking
ALTER TABLE decision_patterns 
ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES pattern_import_jobs(id),
ADD COLUMN IF NOT EXISTS source_message_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_seen_date TIMESTAMP;

-- Function to check if a message was already imported
CREATE OR REPLACE FUNCTION is_message_imported(
  p_message_id VARCHAR(255),
  p_message_hash VARCHAR(64)
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM imported_messages 
    WHERE message_id = p_message_id 
    OR message_hash = p_message_hash
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get import statistics
CREATE OR REPLACE FUNCTION get_import_stats(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_imports INTEGER,
  total_messages_imported INTEGER,
  total_patterns_created INTEGER,
  last_import_date TIMESTAMP,
  duplicate_rate DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT j.id)::INTEGER as total_imports,
    COALESCE(SUM(j.total_messages), 0)::INTEGER as total_messages_imported,
    COALESCE(SUM(j.patterns_created), 0)::INTEGER as total_patterns_created,
    MAX(j.completed_at) as last_import_date,
    CASE 
      WHEN SUM(j.total_messages) > 0 
      THEN (SUM(j.duplicate_messages)::DECIMAL / SUM(j.total_messages) * 100)
      ELSE 0
    END as duplicate_rate
  FROM pattern_import_jobs j
  WHERE (p_user_id IS NULL OR j.user_id = p_user_id)
    AND j.status = 'completed';
END;
$$ LANGUAGE plpgsql;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_status ON pattern_import_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_completed ON pattern_import_jobs(completed_at DESC);

-- Comments for documentation
COMMENT ON TABLE pattern_import_jobs IS 'Tracks CSV import jobs for pattern learning with deduplication';
COMMENT ON TABLE imported_messages IS 'Stores imported message fingerprints to prevent duplicate imports';
COMMENT ON TABLE pattern_message_sources IS 'Links patterns to their source messages for traceability';