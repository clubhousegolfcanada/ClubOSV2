-- Migration: Disable SOP System and Archive Vector Database
-- Date: 2025-07-29
-- Purpose: Remove 300+ poorly categorized vector entries and switch back to OpenAI Assistants

-- Create archive table for audit trail
CREATE TABLE IF NOT EXISTS vector_store_archive (
  id SERIAL PRIMARY KEY,
  archived_at TIMESTAMP DEFAULT NOW(),
  entry_count INTEGER,
  archive_reason TEXT,
  performed_by VARCHAR(255) DEFAULT 'system'
);

-- Archive the vector store metadata before deletion
INSERT INTO vector_store_archive (entry_count, archive_reason)
SELECT 
  COUNT(*), 
  'Disabled SOP system - switching to GPT-4o router with OpenAI Assistants'
FROM sop_embeddings;

-- Create deletion log
CREATE TABLE IF NOT EXISTS vector_store_deletion_log (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(255),
  deleted_count INTEGER,
  deleted_at TIMESTAMP DEFAULT NOW(),
  deletion_reason TEXT
);

-- Log deletions
INSERT INTO vector_store_deletion_log (table_name, deleted_count, deletion_reason)
SELECT 'sop_embeddings', COUNT(*), 'Legacy system teardown - poor categorization'
FROM sop_embeddings;

INSERT INTO vector_store_deletion_log (table_name, deleted_count, deletion_reason)
SELECT 'extracted_knowledge', COUNT(*), 'Legacy system teardown - replacing with assistant routing'
FROM extracted_knowledge
WHERE applied_to_sop = true;

-- Clear vector database tables
TRUNCATE TABLE sop_embeddings CASCADE;
TRUNCATE TABLE sop_shadow_comparisons CASCADE;
TRUNCATE TABLE sop_metrics CASCADE;

-- Update extracted_knowledge to mark SOP-applied entries as archived
UPDATE extracted_knowledge 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb), 
  '{archived}', 
  'true'
)
WHERE applied_to_sop = true;

-- Create new knowledge audit table for the new system
CREATE TABLE IF NOT EXISTS knowledge_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT NOW(),
  action VARCHAR(50) NOT NULL, -- 'add', 'update', 'overwrite'
  category VARCHAR(100),
  key TEXT,
  new_value TEXT,
  previous_value TEXT,
  user_id UUID,
  user_name VARCHAR(255),
  assistant_target VARCHAR(50), -- 'emergency', 'booking', 'tech', 'brand'
  metadata JSONB DEFAULT '{}',
  slack_notified BOOLEAN DEFAULT FALSE
);

-- Create indexes for audit log
CREATE INDEX idx_knowledge_audit_timestamp ON knowledge_audit_log(timestamp DESC);
CREATE INDEX idx_knowledge_audit_category ON knowledge_audit_log(category);
CREATE INDEX idx_knowledge_audit_assistant ON knowledge_audit_log(assistant_target);
CREATE INDEX idx_knowledge_audit_action ON knowledge_audit_log(action);

-- Add configuration flag to disable SOP
INSERT INTO system_config (key, value, description)
VALUES ('sop_system_enabled', 'false', 'Enable/disable the Intelligent SOP Module')
ON CONFLICT (key) DO UPDATE SET value = 'false';

-- Log the migration
INSERT INTO system_logs (level, message, metadata)
VALUES (
  'INFO', 
  'SOP system disabled and vector database archived',
  jsonb_build_object(
    'migration', '013_disable_sop_system',
    'timestamp', NOW(),
    'tables_cleared', ARRAY['sop_embeddings', 'sop_shadow_comparisons', 'sop_metrics']
  )
);