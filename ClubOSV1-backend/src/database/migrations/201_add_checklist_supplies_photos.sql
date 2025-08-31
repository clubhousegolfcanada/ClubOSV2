-- UP
-- Add supplies_needed and photo_urls columns to checklist_submissions table
ALTER TABLE checklist_submissions 
ADD COLUMN IF NOT EXISTS supplies_needed JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT NULL;

-- Add index for filtering submissions with supplies needed
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_supplies 
ON checklist_submissions((supplies_needed IS NOT NULL));

-- Add index for filtering submissions with photos
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_photos 
ON checklist_submissions((photo_urls IS NOT NULL));

-- Add comment for documentation
COMMENT ON COLUMN checklist_submissions.supplies_needed IS 'JSON array of supply items needed with urgency levels';
COMMENT ON COLUMN checklist_submissions.photo_urls IS 'JSON array of photo URLs for damage or issue documentation';

-- DOWN
-- Remove the added columns and indexes
ALTER TABLE checklist_submissions 
DROP COLUMN IF EXISTS supplies_needed,
DROP COLUMN IF EXISTS photo_urls;

DROP INDEX IF EXISTS idx_checklist_submissions_supplies;
DROP INDEX IF EXISTS idx_checklist_submissions_photos;