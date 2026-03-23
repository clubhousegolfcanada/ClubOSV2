-- Migration: ClubAI RAG Knowledge Base
-- Date: 2026-03-23
-- Purpose: Create searchable knowledge base for ClubAI with embeddings for semantic search.
--          Stores past conversations, website content, and manual entries so ClubAI can
--          find relevant context when answering customer messages.

-- ============================================
-- CLUBAI KNOWLEDGE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS clubai_knowledge (
  id SERIAL PRIMARY KEY,

  -- Source classification
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('conversation', 'website', 'manual')),
  intent VARCHAR(50),                          -- sim_frozen, pricing, door_access, booking_change, etc.

  -- The actual Q&A content
  customer_message TEXT,                       -- What the customer asked (NULL for website content)
  team_response TEXT NOT NULL,                 -- How the team responded / the content

  -- Source tracking
  source_id VARCHAR(255),                      -- Conversation ID or URL
  source_url TEXT,                             -- Website URL if applicable
  page_section VARCHAR(255),                   -- Section within a page (e.g. "Pricing > Standard Rate")
  location VARCHAR(50),                        -- Location if relevant (Bedford, Dartmouth, etc.)

  -- Metadata
  metadata JSONB DEFAULT '{}',                 -- Extra context: resolution, operator_name, page_title, etc.

  -- Embedding for semantic search
  embedding FLOAT[],                           -- 1536-dim vector from text-embedding-3-small
  embedding_model VARCHAR(50) DEFAULT 'text-embedding-3-small',
  embedding_generated_at TIMESTAMP,

  -- Quality scoring
  confidence_score FLOAT DEFAULT 0.7 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  use_count INTEGER DEFAULT 0,                 -- How many times this was retrieved as context
  feedback_up INTEGER DEFAULT 0,               -- Operator thumbs-up count
  feedback_down INTEGER DEFAULT 0,             -- Operator thumbs-down count

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_clubai_knowledge_source_type ON clubai_knowledge(source_type) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_clubai_knowledge_intent ON clubai_knowledge(intent) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_clubai_knowledge_has_embedding ON clubai_knowledge(id) WHERE embedding IS NOT NULL AND is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_clubai_knowledge_confidence ON clubai_knowledge(confidence_score DESC) WHERE is_active = TRUE;

-- ============================================
-- COSINE SIMILARITY FUNCTION (if not exists)
-- ============================================

CREATE OR REPLACE FUNCTION cosine_similarity(a FLOAT[], b FLOAT[])
RETURNS FLOAT AS $$
DECLARE
  dot_product FLOAT := 0;
  norm_a FLOAT := 0;
  norm_b FLOAT := 0;
  i INTEGER;
BEGIN
  IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
  IF array_length(a, 1) != array_length(b, 1) THEN RETURN NULL; END IF;

  FOR i IN 1..array_length(a, 1) LOOP
    dot_product := dot_product + (a[i] * b[i]);
    norm_a := norm_a + (a[i] * a[i]);
    norm_b := norm_b + (b[i] * b[i]);
  END LOOP;

  IF norm_a = 0 OR norm_b = 0 THEN RETURN 0; END IF;

  RETURN dot_product / (sqrt(norm_a) * sqrt(norm_b));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- SEARCH FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION find_similar_knowledge(
  query_embedding FLOAT[],
  similarity_threshold FLOAT DEFAULT 0.7,
  max_results INTEGER DEFAULT 8,
  filter_source_type VARCHAR DEFAULT NULL
)
RETURNS TABLE(
  knowledge_id INTEGER,
  source_type VARCHAR(20),
  intent VARCHAR(50),
  customer_message TEXT,
  team_response TEXT,
  page_section VARCHAR(255),
  confidence_score FLOAT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.source_type,
    k.intent,
    k.customer_message,
    k.team_response,
    k.page_section,
    k.confidence_score,
    cosine_similarity(query_embedding, k.embedding) as similarity
  FROM clubai_knowledge k
  WHERE
    k.embedding IS NOT NULL
    AND k.is_active = TRUE
    AND cosine_similarity(query_embedding, k.embedding) >= similarity_threshold
    AND (filter_source_type IS NULL OR k.source_type = filter_source_type)
  ORDER BY similarity DESC, k.confidence_score DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SEARCH LOG (track what knowledge was used per response)
-- ============================================

CREATE TABLE IF NOT EXISTS clubai_knowledge_search_log (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR(255),
  customer_message TEXT,
  knowledge_ids INTEGER[],                    -- Which knowledge entries were retrieved
  similarity_scores FLOAT[],                  -- Corresponding similarity scores
  ai_response TEXT,                           -- What ClubAI generated
  response_quality VARCHAR(20),               -- NULL until operator rates: 'good', 'bad', 'corrected'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubai_search_log_conversation ON clubai_knowledge_search_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_clubai_search_log_quality ON clubai_knowledge_search_log(response_quality) WHERE response_quality IS NOT NULL;
