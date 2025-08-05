-- Learning SOP Module: Knowledge Capture and Update Management
-- This migration creates tables for the self-improving knowledge base

-- Knowledge captures from various sources
DO $$
BEGIN
  -- Create the table first
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'knowledge_captures') THEN
    CREATE TABLE knowledge_captures (
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
  END IF;
  
  -- Then create indexes only if the table exists
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'knowledge_captures') THEN
    -- Create indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_knowledge_captures_assistant') THEN
      CREATE INDEX idx_knowledge_captures_assistant ON knowledge_captures(assistant);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_knowledge_captures_source') THEN
      CREATE INDEX idx_knowledge_captures_source ON knowledge_captures(source);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_knowledge_captures_confidence') THEN
      CREATE INDEX idx_knowledge_captures_confidence ON knowledge_captures(confidence DESC);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_knowledge_captures_created_at') THEN
      CREATE INDEX idx_knowledge_captures_created_at ON knowledge_captures(created_at DESC);
    END IF;
  END IF;
END $$;

-- Queue of suggested SOP updates pending review
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'sop_update_queue') THEN
    CREATE TABLE sop_update_queue (
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
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'sop_update_queue') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sop_update_queue_status') THEN
      CREATE INDEX idx_sop_update_queue_status ON sop_update_queue(status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sop_update_queue_confidence') THEN
      CREATE INDEX idx_sop_update_queue_confidence ON sop_update_queue(confidence DESC);
    END IF;
  END IF;
END $$;

-- Draft SOPs automatically generated from knowledge gaps
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'sop_drafts') THEN
    CREATE TABLE sop_drafts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assistant VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'rejected')),
      created_at TIMESTAMP DEFAULT NOW(),
      published_at TIMESTAMP
    );
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'sop_drafts') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sop_drafts_assistant') THEN
      CREATE INDEX idx_sop_drafts_assistant ON sop_drafts(assistant);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sop_drafts_status') THEN
      CREATE INDEX idx_sop_drafts_status ON sop_drafts(status);
    END IF;
  END IF;
END $$;

-- Log of all SOP updates for audit trail
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'sop_update_log') THEN
    CREATE TABLE sop_update_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id VARCHAR(255) NOT NULL,
      reason TEXT NOT NULL,
      sources JSONB NOT NULL DEFAULT '[]',
      applied_at TIMESTAMP NOT NULL,
      backup_path TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'sop_update_log') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sop_update_log_document_id') THEN
      CREATE INDEX idx_sop_update_log_document_id ON sop_update_log(document_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sop_update_log_applied_at') THEN
      CREATE INDEX idx_sop_update_log_applied_at ON sop_update_log(applied_at DESC);
    END IF;
  END IF;
END $$;

-- Slack thread tracking for learning
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'slack_thread_resolutions') THEN
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
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'slack_thread_resolutions') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_slack_thread_resolutions_resolved_at') THEN
      CREATE INDEX idx_slack_thread_resolutions_resolved_at ON slack_thread_resolutions(resolved_at DESC);
    END IF;
  END IF;
END $$;

-- Learning metrics for monitoring
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'learning_metrics') THEN
    CREATE TABLE learning_metrics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      metric_type VARCHAR(50) NOT NULL,
      assistant VARCHAR(50),
      value FLOAT NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    );
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'learning_metrics') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_learning_metrics_type') THEN
      CREATE INDEX idx_learning_metrics_type ON learning_metrics(metric_type);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_learning_metrics_created_at') THEN
      CREATE INDEX idx_learning_metrics_created_at ON learning_metrics(created_at DESC);
    END IF;
  END IF;
END $$;

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

-- Create triggers
DO $$
BEGIN
  -- Create trigger on knowledge_captures if table exists
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'knowledge_captures') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'knowledge_capture_metrics' 
      AND tgrelid = 'knowledge_captures'::regclass
    ) THEN
      CREATE TRIGGER knowledge_capture_metrics
      AFTER INSERT ON knowledge_captures
      FOR EACH ROW EXECUTE FUNCTION update_learning_metrics();
    END IF;
  END IF;
  
  -- Create trigger on sop_update_queue if table exists
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'sop_update_queue') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'update_approval_metrics' 
      AND tgrelid = 'sop_update_queue'::regclass
    ) THEN
      CREATE TRIGGER update_approval_metrics
      AFTER UPDATE ON sop_update_queue
      FOR EACH ROW WHEN (OLD.status = 'pending_review' AND NEW.status != 'pending_review')
      EXECUTE FUNCTION update_learning_metrics();
    END IF;
  END IF;
END $$;
