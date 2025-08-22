-- UP
-- Make course_id optional for challenges that are decided outside the system
ALTER TABLE challenges 
ALTER COLUMN course_id DROP NOT NULL;

-- Add comment to clarify the field's purpose
COMMENT ON COLUMN challenges.course_id IS 'Course ID for TrackMan settings. NULL when players decide settings outside the challenge system';

-- DOWN
-- Revert: Make course_id required again (but first set a default for existing NULL values)
UPDATE challenges SET course_id = 'MANUAL_ENTRY' WHERE course_id IS NULL;
ALTER TABLE challenges 
ALTER COLUMN course_id SET NOT NULL;