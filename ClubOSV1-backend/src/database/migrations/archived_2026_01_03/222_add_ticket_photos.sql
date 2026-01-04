-- UP
-- Add photo support to tickets table to match checklist functionality
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';

-- Add index for tickets with photos for performance
CREATE INDEX IF NOT EXISTS idx_tickets_has_photos
ON tickets ((array_length(photo_urls, 1) > 0));

-- Add comment explaining the field
COMMENT ON COLUMN tickets.photo_urls IS 'Array of photo URLs (base64 data URLs or external URLs) attached to the ticket for visual documentation';

-- DOWN
ALTER TABLE tickets DROP COLUMN IF EXISTS photo_urls;
DROP INDEX IF EXISTS idx_tickets_has_photos;