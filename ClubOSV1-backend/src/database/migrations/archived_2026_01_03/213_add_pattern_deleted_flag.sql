-- Add soft delete capability to patterns
-- This allows patterns to be hidden without losing data

-- Add deleted flag and deletion metadata
ALTER TABLE decision_patterns 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

-- Create index for non-deleted patterns (most common query)
CREATE INDEX IF NOT EXISTS idx_patterns_not_deleted 
ON decision_patterns(is_deleted) 
WHERE is_deleted = FALSE;

-- Update any patterns that might have been "deleted" by setting is_active = false
-- but should remain visible (seasonal patterns, etc)
-- Only truly deleted patterns should have is_deleted = true

COMMENT ON COLUMN decision_patterns.is_deleted IS 'Soft delete flag - hides pattern from main view';
COMMENT ON COLUMN decision_patterns.deleted_at IS 'When the pattern was deleted';
COMMENT ON COLUMN decision_patterns.deleted_by IS 'User ID who deleted the pattern';