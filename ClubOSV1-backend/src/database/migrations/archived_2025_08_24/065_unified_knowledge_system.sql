-- Migration: Unified Knowledge System
-- Consolidates all knowledge sources into knowledge_store with proper search and versioning

-- UP

-- 1. Add missing columns to knowledge_store if they don't exist
ALTER TABLE knowledge_store 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS source_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS source_table VARCHAR(100),
ADD COLUMN IF NOT EXISTS extracted_from TEXT,
ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS validated_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS auto_confidence FLOAT;

-- 2. Create index for source tracking
CREATE INDEX IF NOT EXISTS idx_knowledge_store_source 
ON knowledge_store(source_type, source_id);

-- 3. Import all SOPs from sop_embeddings into knowledge_store
INSERT INTO knowledge_store (
  key,
  value,
  confidence,
  category,
  search_vector,
  source_type,
  source_id,
  source_table,
  created_at
)
SELECT 
  CONCAT('sop.', assistant, '.', REPLACE(LOWER(title), ' ', '_')) as key,
  jsonb_build_object(
    'title', title,
    'content', content,
    'answer', content,
    'assistant', assistant,
    'metadata', metadata,
    'original_id', id
  ) as value,
  0.9 as confidence, -- SOPs are official procedures, high confidence
  assistant as category,
  to_tsvector('english', title || ' ' || content) as search_vector,
  'sop' as source_type,
  id as source_id,
  'sop_embeddings' as source_table,
  created_at
FROM sop_embeddings
WHERE NOT EXISTS (
  SELECT 1 FROM knowledge_store ks 
  WHERE ks.source_id = sop_embeddings.id 
  AND ks.source_table = 'sop_embeddings'
);

-- 4. Import knowledge from assistant_knowledge
INSERT INTO knowledge_store (
  key,
  value,
  confidence,
  category,
  search_vector,
  source_type,
  source_id,
  source_table,
  created_at
)
SELECT 
  CONCAT('assistant.', route, '.', id) as key,
  jsonb_build_object(
    'content', knowledge,
    'answer', knowledge::text,
    'route', route
  ) as value,
  0.85 as confidence, -- Admin uploaded knowledge
  route as category,
  to_tsvector('english', knowledge::text) as search_vector,
  'assistant_knowledge' as source_type,
  id::text as source_id,
  'assistant_knowledge' as source_table,
  created_at
FROM assistant_knowledge
WHERE NOT EXISTS (
  SELECT 1 FROM knowledge_store ks 
  WHERE ks.source_id = assistant_knowledge.id::text 
  AND ks.source_table = 'assistant_knowledge'
);

-- 5. Import validated extracted knowledge from customer conversations
INSERT INTO knowledge_store (
  key,
  value,
  confidence,
  category,
  search_vector,
  source_type,
  source_id,
  source_table,
  created_at,
  auto_confidence
)
SELECT 
  CONCAT('extracted.', category, '.', id) as key,
  jsonb_build_object(
    'problem', problem,
    'solution', solution,
    'answer', solution,
    'category', category
  ) as value,
  COALESCE(confidence, 0.6) as confidence, -- Lower confidence for extracted
  category,
  to_tsvector('english', problem || ' ' || solution) as search_vector,
  'customer_conversation' as source_type,
  id::text as source_id,
  'extracted_knowledge' as source_table,
  created_at,
  confidence as auto_confidence
FROM extracted_knowledge
WHERE applied_to_sop = true -- Only import validated knowledge
AND NOT EXISTS (
  SELECT 1 FROM knowledge_store ks 
  WHERE ks.source_id = extracted_knowledge.id::text 
  AND ks.source_table = 'extracted_knowledge'
);

-- 6. Create function to automatically extract and add knowledge from OpenPhone
CREATE OR REPLACE FUNCTION extract_knowledge_from_conversation(
  conversation_id VARCHAR,
  messages JSONB,
  extracted_facts JSONB
) RETURNS void AS $$
DECLARE
  fact JSONB;
  fact_key TEXT;
  fact_content TEXT;
  fact_confidence FLOAT;
BEGIN
  -- Process each extracted fact
  FOR fact IN SELECT * FROM jsonb_array_elements(extracted_facts)
  LOOP
    fact_key := fact->>'key';
    fact_content := fact->>'content';
    fact_confidence := COALESCE((fact->>'confidence')::FLOAT, 0.5);
    
    -- Check if this knowledge already exists
    IF NOT EXISTS (
      SELECT 1 FROM knowledge_store 
      WHERE key = fact_key 
      AND superseded_by IS NULL
    ) THEN
      -- Insert new knowledge
      INSERT INTO knowledge_store (
        key,
        value,
        confidence,
        category,
        search_vector,
        source_type,
        source_id,
        source_table,
        extracted_from,
        auto_confidence,
        validation_status
      ) VALUES (
        fact_key,
        jsonb_build_object(
          'content', fact_content,
          'answer', fact_content,
          'conversation_id', conversation_id,
          'metadata', fact->'metadata'
        ),
        fact_confidence * 0.7, -- Reduce confidence for auto-extracted
        COALESCE(fact->>'category', 'general'),
        to_tsvector('english', fact_content),
        'openphone_conversation',
        conversation_id,
        'openphone_conversations',
        messages::text,
        fact_confidence,
        'pending' -- Requires validation
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 7. Create view for easy knowledge querying with source info
CREATE OR REPLACE VIEW knowledge_search_view AS
SELECT 
  k.key,
  k.value,
  k.confidence,
  k.category,
  k.source_type,
  k.source_table,
  k.validation_status,
  k.created_at,
  k.updated_at,
  ts_rank(k.search_vector, plainto_tsquery('english', '')) as relevance,
  CASE 
    WHEN k.source_type = 'sop' THEN 'Official SOP'
    WHEN k.source_type = 'manual' THEN 'Admin Entry'
    WHEN k.source_type = 'assistant_knowledge' THEN 'Assistant Knowledge'
    WHEN k.source_type = 'customer_conversation' THEN 'Learned from Customer'
    WHEN k.source_type = 'openphone_conversation' THEN 'Phone Conversation'
    ELSE 'Other'
  END as source_description
FROM knowledge_store k
WHERE k.superseded_by IS NULL;

-- 8. Add trigger to update search vectors when knowledge is modified
CREATE OR REPLACE FUNCTION update_knowledge_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  -- Extract text content from JSON value
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.value->>'content', '') || ' ' ||
    COALESCE(NEW.value->>'answer', '') || ' ' ||
    COALESCE(NEW.value->>'title', '') || ' ' ||
    COALESCE(NEW.value->>'problem', '') || ' ' ||
    COALESCE(NEW.value->>'solution', '') || ' ' ||
    COALESCE(NEW.key, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_knowledge_search ON knowledge_store;
CREATE TRIGGER trigger_update_knowledge_search
BEFORE INSERT OR UPDATE ON knowledge_store
FOR EACH ROW
EXECUTE FUNCTION update_knowledge_search_vector();

-- 9. Update statistics
ANALYZE knowledge_store;

-- DOWN

-- Remove the trigger
DROP TRIGGER IF EXISTS trigger_update_knowledge_search ON knowledge_store;
DROP FUNCTION IF EXISTS update_knowledge_search_vector();

-- Remove the view
DROP VIEW IF EXISTS knowledge_search_view;

-- Remove the function
DROP FUNCTION IF EXISTS extract_knowledge_from_conversation(VARCHAR, JSONB, JSONB);

-- Remove imported data (keep original tables intact)
DELETE FROM knowledge_store 
WHERE source_table IN ('sop_embeddings', 'assistant_knowledge', 'extracted_knowledge');

-- Remove added columns
ALTER TABLE knowledge_store 
DROP COLUMN IF EXISTS source_type,
DROP COLUMN IF EXISTS source_id,
DROP COLUMN IF EXISTS source_table,
DROP COLUMN IF EXISTS extracted_from,
DROP COLUMN IF EXISTS validation_status,
DROP COLUMN IF EXISTS validated_by,
DROP COLUMN IF EXISTS validated_at,
DROP COLUMN IF EXISTS auto_confidence;

-- Drop index
DROP INDEX IF EXISTS idx_knowledge_store_source;