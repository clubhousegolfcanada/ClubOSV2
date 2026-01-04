-- Migration: Set Semantic Search as Default for V3-PLS
-- Description: Makes semantic search the default for all patterns and configures system for GPT-4o understanding
-- Author: Claude
-- Date: 2025-09-06

-- UP

-- 1. Set default value for semantic_search_enabled to TRUE for new patterns
ALTER TABLE decision_patterns 
ALTER COLUMN semantic_search_enabled SET DEFAULT TRUE;

-- 2. Enable semantic search for all existing patterns
UPDATE decision_patterns 
SET semantic_search_enabled = TRUE 
WHERE semantic_search_enabled IS FALSE OR semantic_search_enabled IS NULL;

-- 3. Add system configuration for semantic search preferences
INSERT INTO pattern_learning_config (config_key, config_value, description, created_at, updated_at)
VALUES 
  ('semantic_search_default', 'true', 
   'Use GPT-4o semantic understanding by default for all new patterns', NOW(), NOW()),
  
  ('semantic_threshold', '0.75', 
   'Minimum similarity score for semantic matches (0.0-1.0)', NOW(), NOW()),
  
  ('prefer_semantic_over_keyword', 'true', 
   'Prioritize semantic matches over keyword matches when both are found', NOW(), NOW()),
  
  ('auto_generate_embeddings', 'true', 
   'Automatically generate embeddings for new patterns using GPT-4o', NOW(), NOW()),
  
  ('learn_variations', 'true', 
   'Automatically learn message variations when patterns succeed', NOW(), NOW())
ON CONFLICT (config_key) DO UPDATE 
SET config_value = EXCLUDED.config_value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- 4. Add index for better semantic search performance
CREATE INDEX IF NOT EXISTS idx_patterns_semantic_enabled 
ON decision_patterns(semantic_search_enabled) 
WHERE is_active = TRUE;

-- 5. Add comment explaining the business logic
COMMENT ON COLUMN decision_patterns.semantic_search_enabled IS 
'Enables GPT-4o semantic understanding for this pattern. When TRUE, the system understands meaning rather than requiring exact matches. For example, "frozen" will match "not working" semantically.';

-- DOWN
ALTER TABLE decision_patterns 
ALTER COLUMN semantic_search_enabled SET DEFAULT FALSE;

UPDATE decision_patterns 
SET semantic_search_enabled = FALSE;

DELETE FROM pattern_learning_config 
WHERE config_key IN (
  'semantic_search_default',
  'semantic_threshold',
  'prefer_semantic_over_keyword',
  'auto_generate_embeddings',
  'learn_variations'
);

DROP INDEX IF EXISTS idx_patterns_semantic_enabled;