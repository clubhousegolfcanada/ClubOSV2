-- Add parent document tracking and multi-category support to sop_embeddings

-- Add parent document ID to track which sections came from the same upload
ALTER TABLE sop_embeddings 
ADD COLUMN IF NOT EXISTS parent_document_id UUID;

-- Add array of categories instead of single assistant field
ALTER TABLE sop_embeddings 
ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT ARRAY['general'];

-- Add related sections tracking
ALTER TABLE sop_embeddings 
ADD COLUMN IF NOT EXISTS related_sections TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create parent documents table to track original uploads
CREATE TABLE IF NOT EXISTS parent_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_filename TEXT,
  upload_date TIMESTAMP DEFAULT NOW(),
  total_sections INT DEFAULT 0,
  uploader_id TEXT,
  original_content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_sop_parent_document 
ON sop_embeddings(parent_document_id);

CREATE INDEX IF NOT EXISTS idx_sop_categories 
ON sop_embeddings USING gin(categories);

CREATE INDEX IF NOT EXISTS idx_parent_docs_date 
ON parent_documents(upload_date DESC);

-- Migrate existing data: copy assistant to categories array
UPDATE sop_embeddings 
SET categories = ARRAY[assistant] 
WHERE categories IS NULL OR categories = '{}';

-- Add comment explaining the structure
COMMENT ON COLUMN sop_embeddings.parent_document_id IS 'Links sections that came from the same uploaded document';
COMMENT ON COLUMN sop_embeddings.categories IS 'Multiple categories this content applies to (brand, tech, booking, emergency)';
COMMENT ON COLUMN sop_embeddings.related_sections IS 'IDs of other sections from the same document';
COMMENT ON TABLE parent_documents IS 'Tracks original uploaded documents before they were split into sections';