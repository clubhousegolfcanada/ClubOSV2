-- Migration: Create flexible knowledge store system
-- Description: Ultra-flexible Winston-style knowledge storage with intelligent features
-- Date: 2024-08-11

-- Drop existing tables if we're replacing them
DROP TABLE IF EXISTS knowledge_store CASCADE;
DROP TABLE IF EXISTS knowledge_patterns CASCADE;
DROP TABLE IF EXISTS knowledge_extraction_log CASCADE;

-- Main flexible storage table
CREATE TABLE knowledge_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  
  -- Intelligence fields
  confidence FLOAT DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  verification_status VARCHAR(20) DEFAULT 'learned' CHECK (verification_status IN ('verified', 'learned', 'pending', 'rejected')),
  source_type VARCHAR(50) DEFAULT 'manual',
  source_count INTEGER DEFAULT 1,
  
  -- Deduplication tracking
  replaces UUID[],
  superseded_by UUID REFERENCES knowledge_store(id),
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  
  -- Search optimization
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', 
      coalesce(key, '') || ' ' ||
      coalesce(value->>'title', '') || ' ' ||
      coalesce(value->>'content', '') || ' ' ||
      coalesce(value->>'problem', '') || ' ' ||
      coalesce(value->>'solution', '') || ' ' ||
      coalesce(value->>'question', '') || ' ' ||
      coalesce(value->>'answer', '') || ' ' ||
      coalesce(value::text, '')
    )
  ) STORED,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  last_accessed TIMESTAMP,
  expires_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_knowledge_search ON knowledge_store USING GIN(search_vector);
CREATE INDEX idx_knowledge_key ON knowledge_store(key);
CREATE INDEX idx_knowledge_key_pattern ON knowledge_store(key text_pattern_ops);
CREATE INDEX idx_knowledge_value ON knowledge_store USING GIN(value);
CREATE INDEX idx_knowledge_confidence ON knowledge_store(confidence DESC);
CREATE INDEX idx_knowledge_usage ON knowledge_store(usage_count DESC);
CREATE INDEX idx_knowledge_verification ON knowledge_store(verification_status);
CREATE INDEX idx_knowledge_updated ON knowledge_store(updated_at DESC);
CREATE INDEX idx_knowledge_expires ON knowledge_store(expires_at) WHERE expires_at IS NOT NULL;

-- Pattern detection table
CREATE TABLE knowledge_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern VARCHAR(255) UNIQUE NOT NULL,
  pattern_type VARCHAR(50), -- 'problem', 'question', 'request', etc.
  occurrence_count INTEGER DEFAULT 1,
  
  -- Best solution tracking
  current_best_solution TEXT,
  current_best_confidence FLOAT DEFAULT 0.5,
  current_best_source UUID REFERENCES knowledge_store(id),
  
  -- Alternative solutions
  alternatives JSONB DEFAULT '[]',
  
  -- Tracking
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_patterns_pattern ON knowledge_patterns(pattern);
CREATE INDEX idx_patterns_occurrence ON knowledge_patterns(occurrence_count DESC);
CREATE INDEX idx_patterns_last_seen ON knowledge_patterns(last_seen DESC);

-- Extraction tracking table
CREATE TABLE knowledge_extraction_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(255),
  
  -- Extraction details
  extraction_type VARCHAR(50), -- 'problem_solved', 'question_answered', 'information_shared'
  extracted_data JSONB,
  confidence FLOAT,
  
  -- Action taken
  action_taken VARCHAR(50), -- 'created_new', 'updated_existing', 'skipped_duplicate', 'skipped_low_confidence'
  knowledge_id UUID REFERENCES knowledge_store(id),
  pattern_id UUID REFERENCES knowledge_patterns(id),
  
  -- Metadata
  skip_reason TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_extraction_conversation ON knowledge_extraction_log(conversation_id);
CREATE INDEX idx_extraction_created ON knowledge_extraction_log(created_at DESC);
CREATE INDEX idx_extraction_action ON knowledge_extraction_log(action_taken);

-- Add knowledge tracking to conversations table
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS knowledge_extracted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS extraction_result JSONB,
ADD COLUMN IF NOT EXISTS knowledge_id UUID REFERENCES knowledge_store(id);

CREATE INDEX IF NOT EXISTS idx_conversations_knowledge_extracted 
ON openphone_conversations(knowledge_extracted) 
WHERE knowledge_extracted = false;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_knowledge_store_updated_at
  BEFORE UPDATE ON knowledge_store
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_updated_at();

CREATE TRIGGER update_knowledge_patterns_updated_at
  BEFORE UPDATE ON knowledge_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_updated_at();

-- Create function to update last_accessed
CREATE OR REPLACE FUNCTION update_knowledge_last_accessed()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE knowledge_store 
  SET last_accessed = NOW(), 
      usage_count = usage_count + 1
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE knowledge_store IS 'Ultra-flexible knowledge storage with Winston-style key-value pairs';
COMMENT ON COLUMN knowledge_store.key IS 'Unique identifier using dot notation (e.g., giftcard.url, procedures.trackman.reset)';
COMMENT ON COLUMN knowledge_store.value IS 'JSONB storage for any type of data - text, objects, arrays, etc.';
COMMENT ON COLUMN knowledge_store.confidence IS 'Confidence score 0-1, higher means more reliable';
COMMENT ON COLUMN knowledge_store.verification_status IS 'verified=admin approved, learned=auto extracted, pending=needs review';
COMMENT ON COLUMN knowledge_store.search_vector IS 'Full-text search index across all content';

COMMENT ON TABLE knowledge_patterns IS 'Tracks patterns in customer queries to identify common issues';
COMMENT ON TABLE knowledge_extraction_log IS 'Audit trail of knowledge extracted from conversations';

-- Insert initial seed data (example)
INSERT INTO knowledge_store (key, value, verification_status, confidence, source_type) VALUES
  ('system.initialized', '"true"', 'verified', 1.0, 'manual'),
  ('system.version', '"1.0.0"', 'verified', 1.0, 'manual')
ON CONFLICT (key) DO NOTHING;