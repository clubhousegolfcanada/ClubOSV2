-- Migration: Add Embeddings Support for Pattern Semantic Search
-- Author: Claude
-- Date: 2025-09-03
-- Purpose: Enable semantic search for pattern matching using OpenAI embeddings

-- ============================================
-- ADD EMBEDDING SUPPORT TO PATTERNS
-- ============================================

-- Add embedding column to store vector representation
ALTER TABLE decision_patterns 
ADD COLUMN IF NOT EXISTS embedding FLOAT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(50) DEFAULT 'text-embedding-3-small',
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS semantic_search_enabled BOOLEAN DEFAULT FALSE;

-- Add columns for tracking semantic matches
ALTER TABLE pattern_execution_history
ADD COLUMN IF NOT EXISTS match_type VARCHAR(20) DEFAULT 'keyword', -- 'keyword', 'semantic', 'exact', 'hybrid'
ADD COLUMN IF NOT EXISTS similarity_score FLOAT,
ADD COLUMN IF NOT EXISTS matched_keywords TEXT[];

-- ============================================
-- PATTERN SIMILARITY TRACKING
-- ============================================

-- Track which patterns are similar to each other
CREATE TABLE IF NOT EXISTS pattern_similarities (
  id SERIAL PRIMARY KEY,
  pattern_a_id INTEGER REFERENCES decision_patterns(id) ON DELETE CASCADE,
  pattern_b_id INTEGER REFERENCES decision_patterns(id) ON DELETE CASCADE,
  similarity_score FLOAT NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  calculation_method VARCHAR(20) DEFAULT 'cosine', -- cosine, euclidean, manhattan
  last_calculated TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(pattern_a_id, pattern_b_id),
  CHECK (pattern_a_id < pattern_b_id) -- Ensure we don't store duplicates (A->B and B->A)
);

-- ============================================
-- EMBEDDING CACHE FOR MESSAGES
-- ============================================

-- Cache embeddings for frequently seen messages
CREATE TABLE IF NOT EXISTS message_embeddings (
  id SERIAL PRIMARY KEY,
  message_hash VARCHAR(64) UNIQUE NOT NULL, -- MD5 hash of normalized message
  message_text TEXT NOT NULL,
  embedding FLOAT[] NOT NULL,
  embedding_model VARCHAR(50) DEFAULT 'text-embedding-3-small',
  use_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PATTERN LIFECYCLE MANAGEMENT
-- ============================================

-- Track pattern lifecycle events
CREATE TABLE IF NOT EXISTS pattern_lifecycle_events (
  id SERIAL PRIMARY KEY,
  pattern_id INTEGER REFERENCES decision_patterns(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'created', 'promoted', 'demoted', 'archived', 'merged', 'decay_applied'
  old_confidence FLOAT,
  new_confidence FLOAT,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Archive table for old/unused patterns
CREATE TABLE IF NOT EXISTS archived_patterns (
  id SERIAL PRIMARY KEY,
  original_pattern_id INTEGER,
  pattern_type VARCHAR(50),
  pattern_signature VARCHAR(255),
  trigger_text TEXT,
  trigger_keywords TEXT[],
  response_template TEXT,
  action_template JSONB,
  confidence_score FLOAT,
  execution_count INTEGER,
  success_count INTEGER,
  failure_count INTEGER,
  archived_reason VARCHAR(100),
  archived_at TIMESTAMP DEFAULT NOW(),
  archived_by INTEGER REFERENCES users(id),
  
  -- Keep the embedding for potential future use
  embedding FLOAT[],
  
  -- Store complete history
  full_history JSONB
);

-- ============================================
-- FUNCTIONS FOR SEMANTIC SEARCH
-- ============================================

-- Function to calculate cosine similarity between two vectors
CREATE OR REPLACE FUNCTION cosine_similarity(a FLOAT[], b FLOAT[]) 
RETURNS FLOAT AS $$
DECLARE
  dot_product FLOAT := 0;
  norm_a FLOAT := 0;
  norm_b FLOAT := 0;
  i INTEGER;
BEGIN
  -- Check if arrays have same length
  IF array_length(a, 1) != array_length(b, 1) THEN
    RETURN NULL;
  END IF;
  
  -- Calculate dot product and norms
  FOR i IN 1..array_length(a, 1) LOOP
    dot_product := dot_product + (a[i] * b[i]);
    norm_a := norm_a + (a[i] * a[i]);
    norm_b := norm_b + (b[i] * b[i]);
  END LOOP;
  
  -- Avoid division by zero
  IF norm_a = 0 OR norm_b = 0 THEN
    RETURN 0;
  END IF;
  
  -- Return cosine similarity
  RETURN dot_product / (sqrt(norm_a) * sqrt(norm_b));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find similar patterns using embeddings
CREATE OR REPLACE FUNCTION find_similar_patterns(
  query_embedding FLOAT[],
  threshold FLOAT DEFAULT 0.8,
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE(
  pattern_id INTEGER,
  pattern_type VARCHAR(50),
  response_template TEXT,
  confidence_score FLOAT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.pattern_type,
    p.response_template,
    p.confidence_score,
    cosine_similarity(query_embedding, p.embedding) as similarity
  FROM decision_patterns p
  WHERE 
    p.embedding IS NOT NULL
    AND p.is_active = TRUE
    AND cosine_similarity(query_embedding, p.embedding) >= threshold
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to apply confidence decay to unused patterns
CREATE OR REPLACE FUNCTION apply_confidence_decay(
  decay_rate FLOAT DEFAULT 0.01,
  days_inactive INTEGER DEFAULT 7
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  WITH patterns_to_decay AS (
    SELECT id, confidence_score
    FROM decision_patterns
    WHERE 
      is_active = TRUE
      AND last_used < NOW() - INTERVAL '1 day' * days_inactive
      AND confidence_score > 0.1 -- Don't decay below 0.1
  )
  UPDATE decision_patterns p
  SET 
    confidence_score = GREATEST(0.1, confidence_score - decay_rate),
    last_modified = NOW()
  FROM patterns_to_decay ptd
  WHERE p.id = ptd.id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Log decay events
  INSERT INTO pattern_lifecycle_events (
    pattern_id, 
    event_type, 
    old_confidence, 
    new_confidence, 
    reason
  )
  SELECT 
    ptd.id,
    'decay_applied',
    ptd.confidence_score,
    GREATEST(0.1, ptd.confidence_score - decay_rate),
    'Automatic decay due to ' || days_inactive || ' days of inactivity'
  FROM patterns_to_decay ptd;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to archive low-performing patterns
CREATE OR REPLACE FUNCTION archive_low_performing_patterns(
  confidence_threshold FLOAT DEFAULT 0.2,
  min_age_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER := 0;
BEGIN
  -- Archive patterns that are old and have low confidence
  WITH patterns_to_archive AS (
    SELECT 
      p.*,
      (
        SELECT json_agg(peh.*)
        FROM pattern_execution_history peh
        WHERE peh.pattern_id = p.id
      ) as history
    FROM decision_patterns p
    WHERE 
      p.confidence_score < confidence_threshold
      AND p.first_seen < NOW() - INTERVAL '1 day' * min_age_days
      AND p.is_active = TRUE
  )
  INSERT INTO archived_patterns (
    original_pattern_id,
    pattern_type,
    pattern_signature,
    trigger_text,
    trigger_keywords,
    response_template,
    action_template,
    confidence_score,
    execution_count,
    success_count,
    failure_count,
    archived_reason,
    embedding,
    full_history
  )
  SELECT 
    id,
    pattern_type,
    pattern_signature,
    trigger_text,
    trigger_keywords,
    response_template,
    action_template,
    confidence_score,
    execution_count,
    success_count,
    failure_count,
    'Low confidence (' || confidence_score || ') after ' || min_age_days || ' days',
    embedding,
    history
  FROM patterns_to_archive;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  -- Mark patterns as inactive
  UPDATE decision_patterns
  SET is_active = FALSE
  WHERE id IN (SELECT id FROM patterns_to_archive);
  
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index for similarity calculations (if we had pgvector, we'd use HNSW)
CREATE INDEX IF NOT EXISTS idx_patterns_embedding_exists 
ON decision_patterns(id) 
WHERE embedding IS NOT NULL AND is_active = TRUE;

-- Index for pattern similarities
CREATE INDEX IF NOT EXISTS idx_pattern_similarities_a ON pattern_similarities(pattern_a_id);
CREATE INDEX IF NOT EXISTS idx_pattern_similarities_b ON pattern_similarities(pattern_b_id);
CREATE INDEX IF NOT EXISTS idx_pattern_similarities_score ON pattern_similarities(similarity_score DESC);

-- Index for message embeddings
CREATE INDEX IF NOT EXISTS idx_message_embeddings_hash ON message_embeddings(message_hash);
CREATE INDEX IF NOT EXISTS idx_message_embeddings_used ON message_embeddings(last_used DESC);

-- Index for lifecycle events
CREATE INDEX IF NOT EXISTS idx_lifecycle_pattern ON pattern_lifecycle_events(pattern_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_type ON pattern_lifecycle_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lifecycle_created ON pattern_lifecycle_events(created_at DESC);

-- ============================================
-- SCHEDULED JOBS (To be run via cron or similar)
-- ============================================

-- Job 1: Apply confidence decay daily
-- SELECT apply_confidence_decay(0.01, 7);

-- Job 2: Archive low-performing patterns weekly  
-- SELECT archive_low_performing_patterns(0.2, 30);

-- Job 3: Calculate pattern similarities after new patterns added
-- (Implemented in application code)

-- Job 4: Clean up old message embeddings monthly
-- DELETE FROM message_embeddings WHERE last_used < NOW() - INTERVAL '90 days';

-- ============================================
-- INITIAL SETUP
-- ============================================

-- Mark that we need to generate embeddings for existing patterns
UPDATE decision_patterns 
SET semantic_search_enabled = FALSE 
WHERE embedding IS NULL;

-- Add comment explaining the migration
COMMENT ON COLUMN decision_patterns.embedding IS 
'OpenAI text-embedding-3-small vector (1536 dimensions) for semantic search';

COMMENT ON TABLE pattern_similarities IS 
'Pre-calculated similarity scores between patterns to enable clustering and deduplication';

COMMENT ON TABLE message_embeddings IS 
'Cache of message embeddings to avoid repeated API calls for common messages';

COMMENT ON FUNCTION cosine_similarity IS 
'Calculate cosine similarity between two embedding vectors (1.0 = identical, 0 = orthogonal)';