-- Fix missing tables that failed to create due to migration runner issue
-- This migration ensures all critical tables exist

-- 1. Fix door_access_log table
DROP TABLE IF EXISTS door_access_log CASCADE;

CREATE TABLE door_access_log (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(50) NOT NULL,
  location VARCHAR(100) NOT NULL,
  door_id VARCHAR(100) NOT NULL,
  door_name VARCHAR(100),
  initiated_by VARCHAR(255) NOT NULL,
  duration_seconds INTEGER,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'initiated',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  metadata JSONB
);

CREATE INDEX idx_door_access_location ON door_access_log(location);
CREATE INDEX idx_door_access_created ON door_access_log(created_at DESC);
CREATE INDEX idx_door_access_user ON door_access_log(initiated_by);
CREATE INDEX idx_door_access_status ON door_access_log(status);

-- 2. Fix knowledge_captures table
DROP TABLE IF EXISTS knowledge_captures CASCADE;

CREATE TABLE knowledge_captures (
  id VARCHAR(255) PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  assistant VARCHAR(50) NOT NULL,
  confidence FLOAT NOT NULL DEFAULT 0.5,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  verified_by VARCHAR(255),
  metadata JSONB DEFAULT '{}'
);

-- Add CHECK constraint separately to avoid parsing issues
ALTER TABLE knowledge_captures ADD CONSTRAINT check_source 
  CHECK (source IN ('slack', 'chat', 'ticket', 'manual'));

CREATE INDEX idx_knowledge_captures_assistant ON knowledge_captures(assistant);
CREATE INDEX idx_knowledge_captures_source ON knowledge_captures(source);
CREATE INDEX idx_knowledge_captures_confidence ON knowledge_captures(confidence DESC);
CREATE INDEX idx_knowledge_captures_created_at ON knowledge_captures(created_at DESC);

-- 3. Fix sop_update_queue table
DROP TABLE IF EXISTS sop_update_queue CASCADE;

CREATE TABLE sop_update_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR(255) NOT NULL,
  original_content TEXT NOT NULL,
  suggested_content TEXT NOT NULL,
  reason TEXT NOT NULL,
  confidence FLOAT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'pending_review',
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  review_notes TEXT
);

ALTER TABLE sop_update_queue ADD CONSTRAINT check_status 
  CHECK (status IN ('pending_review', 'approved', 'rejected', 'applied'));

CREATE INDEX idx_sop_update_queue_status ON sop_update_queue(status);
CREATE INDEX idx_sop_update_queue_confidence ON sop_update_queue(confidence DESC);

-- 4. Fix sop_drafts table
DROP TABLE IF EXISTS sop_drafts CASCADE;

CREATE TABLE sop_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP
);

ALTER TABLE sop_drafts ADD CONSTRAINT check_draft_status 
  CHECK (status IN ('draft', 'published', 'rejected'));

CREATE INDEX idx_sop_drafts_assistant ON sop_drafts(assistant);
CREATE INDEX idx_sop_drafts_status ON sop_drafts(status);

-- 5. Fix sop_update_log table
DROP TABLE IF EXISTS sop_update_log CASCADE;

CREATE TABLE sop_update_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]',
  applied_at TIMESTAMP NOT NULL,
  backup_path TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sop_update_log_document_id ON sop_update_log(document_id);
CREATE INDEX idx_sop_update_log_applied_at ON sop_update_log(applied_at DESC);

-- 6. Fix slack_thread_resolutions table
DROP TABLE IF EXISTS slack_thread_resolutions CASCADE;

CREATE TABLE slack_thread_resolutions (
  thread_ts VARCHAR(255) PRIMARY KEY,
  original_query TEXT NOT NULL,
  final_resolution TEXT,
  was_helpful BOOLEAN,
  resolver VARCHAR(255),
  resolved_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_slack_thread_resolutions_resolved_at ON slack_thread_resolutions(resolved_at DESC);

-- 7. Fix learning_metrics table
DROP TABLE IF EXISTS learning_metrics CASCADE;

CREATE TABLE learning_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type VARCHAR(50) NOT NULL,
  assistant VARCHAR(50),
  value FLOAT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_learning_metrics_type ON learning_metrics(metric_type);
CREATE INDEX idx_learning_metrics_created_at ON learning_metrics(created_at DESC);

-- Note: Triggers will be added in a separate migration to avoid complexity