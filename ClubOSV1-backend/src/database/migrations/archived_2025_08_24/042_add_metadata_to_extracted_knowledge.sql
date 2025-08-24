-- Add metadata column to extracted_knowledge table for storing additional context
ALTER TABLE extracted_knowledge
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create index for better performance when querying by source_type
CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_source_type ON extracted_knowledge(source_type);

-- Create index for querying recent knowledge
CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_created_at ON extracted_knowledge(created_at DESC);