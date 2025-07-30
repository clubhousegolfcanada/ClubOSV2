-- OpenPhone Integration and SOP System Tables
-- This migration adds support for OpenPhone conversation capture and knowledge extraction

-- OpenPhone conversations storage
CREATE TABLE IF NOT EXISTS openphone_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20),
  customer_name VARCHAR(255),
  employee_name VARCHAR(255),
  messages JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'
);

-- Extracted knowledge from conversations
CREATE TABLE IF NOT EXISTS extracted_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID,
  source_type VARCHAR(20),
  category VARCHAR(50),
  problem TEXT NOT NULL,
  solution TEXT NOT NULL,
  confidence FLOAT,
  applied_to_sop BOOLEAN DEFAULT FALSE,
  sop_file VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Shadow mode comparison tracking
CREATE TABLE IF NOT EXISTS sop_shadow_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  route VARCHAR(50) NOT NULL,
  assistant_response TEXT,
  sop_response TEXT,
  sop_confidence FLOAT,
  sop_time_ms INTEGER,
  assistant_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- SOP performance metrics
CREATE TABLE IF NOT EXISTS sop_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  total_requests INTEGER DEFAULT 0,
  sop_used INTEGER DEFAULT 0,
  assistant_used INTEGER DEFAULT 0,
  sop_avg_confidence FLOAT,
  sop_avg_response_time_ms FLOAT,
  assistant_avg_response_time_ms FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX idx_openphone_conversations_processed ON openphone_conversations(processed);
CREATE INDEX idx_openphone_conversations_created_at ON openphone_conversations(created_at DESC);
CREATE INDEX idx_extracted_knowledge_category ON extracted_knowledge(category);
CREATE INDEX idx_extracted_knowledge_applied ON extracted_knowledge(applied_to_sop);
CREATE INDEX idx_extracted_knowledge_source ON extracted_knowledge(source_id);
CREATE INDEX idx_shadow_comparisons_created_at ON sop_shadow_comparisons(created_at DESC);
CREATE INDEX idx_shadow_comparisons_route ON sop_shadow_comparisons(route);
CREATE INDEX idx_sop_metrics_date ON sop_metrics(date DESC);

-- Function to aggregate daily metrics
CREATE OR REPLACE FUNCTION update_daily_sop_metrics()
RETURNS void AS $$
BEGIN
  INSERT INTO sop_metrics (
    date,
    total_requests,
    sop_used,
    assistant_used,
    sop_avg_confidence,
    sop_avg_response_time_ms,
    assistant_avg_response_time_ms
  )
  SELECT 
    CURRENT_DATE,
    COUNT(*),
    COUNT(CASE WHEN sop_response IS NOT NULL THEN 1 END),
    COUNT(CASE WHEN assistant_response IS NOT NULL THEN 1 END),
    AVG(CASE WHEN sop_response IS NOT NULL THEN sop_confidence END),
    AVG(CASE WHEN sop_response IS NOT NULL THEN sop_time_ms END),
    AVG(CASE WHEN assistant_response IS NOT NULL THEN assistant_time_ms END)
  FROM sop_shadow_comparisons
  WHERE DATE(created_at) = CURRENT_DATE
  ON CONFLICT (date) DO UPDATE SET
    total_requests = EXCLUDED.total_requests,
    sop_used = EXCLUDED.sop_used,
    assistant_used = EXCLUDED.assistant_used,
    sop_avg_confidence = EXCLUDED.sop_avg_confidence,
    sop_avg_response_time_ms = EXCLUDED.sop_avg_response_time_ms,
    assistant_avg_response_time_ms = EXCLUDED.assistant_avg_response_time_ms;
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint on date for metrics
ALTER TABLE sop_metrics ADD CONSTRAINT unique_sop_metrics_date UNIQUE (date);