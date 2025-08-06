-- Learning SOP Module: Knowledge Capture and Update Management
-- This migration creates tables for the self-improving knowledge base

-- Knowledge captures from various sources
CREATE TABLE IF NOT EXISTS knowledge_captures (
  id VARCHAR(255) PRIMARY KEY,
  source VARCHAR(50) NOT NULL CHECK (source IN ('slack', 'chat', 'ticket', 'manual')),
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  assistant VARCHAR(50) NOT NULL,
  confidence FLOAT NOT NULL DEFAULT 0.5,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  verified_by VARCHAR(255),
  metadata JSONB DEFAULT '{}'
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_knowledge_captures_assistant ON knowledge_captures(assistant);
CREATE INDEX IF NOT EXISTS idx_knowledge_captures_source ON knowledge_captures(source);
CREATE INDEX IF NOT EXISTS idx_knowledge_captures_confidence ON knowledge_captures(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_captures_created_at ON knowledge_captures(created_at DESC);

-- Queue of suggested SOP updates pending review
CREATE TABLE IF NOT EXISTS sop_update_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR(255) NOT NULL,
  original_content TEXT NOT NULL,
  suggested_content TEXT NOT NULL,
  reason TEXT NOT NULL,
  confidence FLOAT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'applied')),
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  review_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_sop_update_queue_status ON sop_update_queue(status);
CREATE INDEX IF NOT EXISTS idx_sop_update_queue_confidence ON sop_update_queue(confidence DESC);

-- Draft SOPs automatically generated from knowledge gaps
CREATE TABLE IF NOT EXISTS sop_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sop_drafts_assistant ON sop_drafts(assistant);
CREATE INDEX IF NOT EXISTS idx_sop_drafts_status ON sop_drafts(status);

-- Log of all SOP updates for audit trail
CREATE TABLE IF NOT EXISTS sop_update_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]',
  applied_at TIMESTAMP NOT NULL,
  backup_path TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sop_update_log_document_id ON sop_update_log(document_id);
CREATE INDEX IF NOT EXISTS idx_sop_update_log_applied_at ON sop_update_log(applied_at DESC);

-- Slack thread tracking for learning
CREATE TABLE IF NOT EXISTS slack_thread_resolutions (
  thread_ts VARCHAR(255) PRIMARY KEY,
  original_query TEXT NOT NULL,
  final_resolution TEXT,
  was_helpful BOOLEAN,
  resolver VARCHAR(255),
  resolved_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slack_thread_resolutions_resolved_at ON slack_thread_resolutions(resolved_at DESC);

-- Learning metrics for monitoring
CREATE TABLE IF NOT EXISTS learning_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type VARCHAR(50) NOT NULL,
  assistant VARCHAR(50),
  value FLOAT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_metrics_type ON learning_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_learning_metrics_created_at ON learning_metrics(created_at DESC);

-- Add triggers for automated metrics
CREATE OR REPLACE FUNCTION update_learning_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Track knowledge capture rate
  IF TG_TABLE_NAME = 'knowledge_captures' THEN
    INSERT INTO learning_metrics (metric_type, assistant, value, metadata)
    VALUES ('capture_rate', NEW.assistant, 1, jsonb_build_object('source', NEW.source));
  END IF;
  
  -- Track update approval rate
  IF TG_TABLE_NAME = 'sop_update_queue' AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO learning_metrics (metric_type, assistant, value, metadata)
    VALUES (
      'update_' || NEW.status, 
      (NEW.metadata->>'assistant')::text, 
      NEW.confidence,
      jsonb_build_object('update_id', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers only if tables exist
-- Note: We can't use DO blocks here because the migration runner splits incorrectly
-- So we'll just use CREATE TRIGGER and let it fail silently if table doesn't exist