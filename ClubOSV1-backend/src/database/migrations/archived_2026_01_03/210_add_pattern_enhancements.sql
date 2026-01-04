-- Migration: Add enhanced pattern fields for better trigger and response editing
-- This allows storing multiple trigger examples and validates with GPT-4o

-- Add new columns to decision_patterns if they don't exist
ALTER TABLE decision_patterns 
ADD COLUMN IF NOT EXISTS trigger_examples TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS additional_signatures TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS embedding FLOAT[],
ADD COLUMN IF NOT EXISTS semantic_search_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS gpt4o_validated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_validation_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_by INTEGER,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Create index for semantic search if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_patterns_semantic_search 
ON decision_patterns(semantic_search_enabled) 
WHERE semantic_search_enabled = TRUE;

-- Create index for embeddings (using GIN for array operations)
CREATE INDEX IF NOT EXISTS idx_patterns_embedding 
ON decision_patterns USING GIN(embedding) 
WHERE embedding IS NOT NULL;

-- Add trigger examples for existing patterns based on their pattern text
UPDATE decision_patterns
SET trigger_examples = ARRAY[pattern]
WHERE trigger_examples = '{}' OR trigger_examples IS NULL;

-- Specifically fix the pricing pattern
UPDATE decision_patterns
SET 
  pattern = 'How much does it cost?',
  trigger_examples = ARRAY[
    'How much does it cost?',
    'What are your prices?',
    'What''s the pricing?',
    'How much for an hour?',
    'What are your rates?',
    'How much do you charge?',
    'Can you tell me the price?',
    'What''s the cost per hour?'
  ],
  trigger_keywords = ARRAY[
    'price', 'pricing', 'cost', 'how much', 'rate', 'rates', 
    'fee', 'fees', 'charge', 'charges', 'pay', 'payment',
    'hourly', 'per hour', 'membership', 'package', 'packages'
  ],
  semantic_search_enabled = true,
  gpt4o_validated = false
WHERE 
  pattern = 'Providing specific pricing information.'
  OR (response_template LIKE '%clubhouse247golf.com/pricing%' 
      AND pattern_type = 'faq'
      AND pattern != 'How much does it cost?');

-- Create a function for cosine similarity if it doesn't exist
CREATE OR REPLACE FUNCTION cosine_similarity(a float[], b float[])
RETURNS float AS $$
DECLARE
  dot_product float := 0;
  norm_a float := 0;
  norm_b float := 0;
  i int;
BEGIN
  IF array_length(a, 1) != array_length(b, 1) THEN
    RETURN 0;
  END IF;
  
  FOR i IN 1..array_length(a, 1) LOOP
    dot_product := dot_product + (a[i] * b[i]);
    norm_a := norm_a + (a[i] * a[i]);
    norm_b := norm_b + (b[i] * b[i]);
  END LOOP;
  
  IF norm_a = 0 OR norm_b = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN dot_product / (sqrt(norm_a) * sqrt(norm_b));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create embedding cache table if it doesn't exist
CREATE TABLE IF NOT EXISTS embedding_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(64) UNIQUE NOT NULL,
  text_input TEXT NOT NULL,
  embedding FLOAT[] NOT NULL,
  model VARCHAR(50) DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMP DEFAULT NOW(),
  last_accessed TIMESTAMP DEFAULT NOW()
);

-- Create index on cache key
CREATE INDEX IF NOT EXISTS idx_embedding_cache_key 
ON embedding_cache(cache_key);

-- Clean up old cache entries (older than 30 days)
DELETE FROM embedding_cache 
WHERE created_at < NOW() - INTERVAL '30 days';

-- Add comment explaining the new fields
COMMENT ON COLUMN decision_patterns.trigger_examples IS 'Multiple example questions that should trigger this pattern';
COMMENT ON COLUMN decision_patterns.additional_signatures IS 'MD5 signatures of trigger examples for faster matching';
COMMENT ON COLUMN decision_patterns.embedding IS 'Vector embedding for semantic search';
COMMENT ON COLUMN decision_patterns.semantic_search_enabled IS 'Whether to use semantic search for this pattern';
COMMENT ON COLUMN decision_patterns.gpt4o_validated IS 'Whether the response has been validated by GPT-4o';

-- Update pattern learning config to ensure it's enabled
INSERT INTO pattern_learning_config (config_key, config_value)
VALUES 
  ('enabled', 'true'),
  ('shadow_mode', 'false'),
  ('use_semantic_search', 'true'),
  ('validate_with_gpt4o', 'true')
ON CONFLICT (config_key) DO UPDATE 
SET config_value = EXCLUDED.config_value;