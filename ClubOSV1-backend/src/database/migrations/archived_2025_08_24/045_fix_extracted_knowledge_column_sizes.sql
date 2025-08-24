-- Fix column size constraints in extracted_knowledge table
-- The source_type column is too small for 'openphone_conversation' (22 chars)

-- Increase source_type column size
ALTER TABLE extracted_knowledge 
ALTER COLUMN source_type TYPE VARCHAR(50);

-- Also increase category size for more flexibility
ALTER TABLE extracted_knowledge 
ALTER COLUMN category TYPE VARCHAR(100);

-- Add comment explaining the sizes
COMMENT ON COLUMN extracted_knowledge.source_type IS 'Source type: openphone_conversation, call_transcript, manual_entry, etc.';
COMMENT ON COLUMN extracted_knowledge.category IS 'Category: booking, tech_support, emergency, brand_tone, etc.';