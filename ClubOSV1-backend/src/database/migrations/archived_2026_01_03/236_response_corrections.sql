-- Migration: Add Response Corrections Tracking
-- Description: Track all response corrections made through the inline edit feature
-- Author: ClubOS Team
-- Date: 2025-10-03

-- Create table to track all response corrections
CREATE TABLE IF NOT EXISTS response_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The correction details
  original_response TEXT NOT NULL,
  corrected_response TEXT NOT NULL,

  -- Track what was updated
  knowledge_updated INTEGER DEFAULT 0,
  patterns_updated INTEGER DEFAULT 0,
  new_entries_created INTEGER DEFAULT 0,

  -- User information
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),

  -- Context information
  context JSONB,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_corrections_user_id ON response_corrections(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_corrections_created_at ON response_corrections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_user_email ON response_corrections(user_email);

-- Create trigger function to automatically log knowledge corrections
CREATE OR REPLACE FUNCTION log_knowledge_correction()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if verification status changed to 'verified'
  IF NEW.verification_status = 'verified' AND
     (OLD.verification_status IS NULL OR OLD.verification_status != 'verified') THEN

    -- Try to extract response from JSONB
    DECLARE
      old_response TEXT;
      new_response TEXT;
    BEGIN
      -- Safely extract response field if it exists
      old_response := OLD.value->>'response';
      new_response := NEW.value->>'response';

      -- Only log if both responses exist and are different
      IF old_response IS NOT NULL AND new_response IS NOT NULL AND old_response != new_response THEN
        INSERT INTO response_corrections (
          original_response,
          corrected_response,
          knowledge_updated,
          user_id
        ) VALUES (
          old_response,
          new_response,
          1,
          NEW.updated_by
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Silently continue if there's any error extracting the response
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on knowledge_store to log corrections
DROP TRIGGER IF EXISTS knowledge_correction_trigger ON knowledge_store;
CREATE TRIGGER knowledge_correction_trigger
AFTER UPDATE ON knowledge_store
FOR EACH ROW
EXECUTE FUNCTION log_knowledge_correction();

-- Add updated_by column to knowledge_store if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='knowledge_store'
    AND column_name='updated_by'
  ) THEN
    ALTER TABLE knowledge_store ADD COLUMN updated_by UUID REFERENCES users(id);
  END IF;
END $$;

-- Create a view for easy correction reporting
CREATE OR REPLACE VIEW correction_summary AS
SELECT
  rc.id,
  rc.original_response,
  rc.corrected_response,
  rc.knowledge_updated,
  rc.user_email,
  rc.created_at,
  u.name as corrected_by_name,
  rc.context->>'route' as route,
  rc.context->>'originalQuery' as original_query
FROM response_corrections rc
LEFT JOIN users u ON rc.user_id = u.id
ORDER BY rc.created_at DESC;

-- Grant permissions (adjust based on your database user setup)
-- GRANT ALL ON response_corrections TO clubos_app;
-- GRANT SELECT ON correction_summary TO clubos_app;

-- Add comment for documentation
COMMENT ON TABLE response_corrections IS 'Tracks all corrections made to AI responses through the inline edit feature';
COMMENT ON COLUMN response_corrections.original_response IS 'The original incorrect response from the AI';
COMMENT ON COLUMN response_corrections.corrected_response IS 'The corrected response provided by the operator';
COMMENT ON COLUMN response_corrections.knowledge_updated IS 'Number of knowledge_store entries that were updated';
COMMENT ON COLUMN response_corrections.context IS 'Additional context including route, original query, and confidence';