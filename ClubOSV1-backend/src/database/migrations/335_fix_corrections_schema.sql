-- Migration: Fix Corrections System Schema
-- Author: ClubOS Team
-- Date: 2025-10-22
-- Purpose: Add missing columns for corrections system to work properly
-- Issue: Corrections failing with "column does not exist" errors

-- ============================================
-- 1. Fix knowledge_store table
-- ============================================

-- Add missing updated_by column
ALTER TABLE knowledge_store
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_store_updated_by
ON knowledge_store(updated_by)
WHERE updated_by IS NOT NULL;

-- ============================================
-- 2. Fix decision_patterns table
-- ============================================

-- Add missing metadata column for storing correction context
ALTER TABLE decision_patterns
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add missing last_modified_by column for tracking who updated patterns
ALTER TABLE decision_patterns
ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES users(id);

-- Add updated_at column if missing (for consistency)
ALTER TABLE decision_patterns
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_decision_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_decision_patterns_updated_at_trigger ON decision_patterns;
CREATE TRIGGER update_decision_patterns_updated_at_trigger
BEFORE UPDATE ON decision_patterns
FOR EACH ROW
EXECUTE FUNCTION update_decision_patterns_updated_at();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_decision_patterns_last_modified_by
ON decision_patterns(last_modified_by)
WHERE last_modified_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_decision_patterns_updated_at
ON decision_patterns(updated_at DESC);

-- ============================================
-- 3. Ensure response_corrections table exists
-- ============================================

CREATE TABLE IF NOT EXISTS response_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to response tracking
  response_id UUID REFERENCES response_tracking(id),

  -- The correction details
  original_response TEXT NOT NULL,
  corrected_response TEXT NOT NULL,

  -- Track what was updated
  knowledge_updated INTEGER DEFAULT 0,
  patterns_updated INTEGER DEFAULT 0,
  new_entries_created INTEGER DEFAULT 0,

  -- Pattern tracking
  pattern_id INTEGER REFERENCES decision_patterns(id),
  pattern_created BOOLEAN DEFAULT FALSE,

  -- User information
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),

  -- Context information
  context JSONB,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for response_corrections if they don't exist
CREATE INDEX IF NOT EXISTS idx_response_corrections_user_id
ON response_corrections(user_id)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_response_corrections_created_at
ON response_corrections(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_response_corrections_pattern_id
ON response_corrections(pattern_id)
WHERE pattern_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_response_corrections_response_id
ON response_corrections(response_id)
WHERE response_id IS NOT NULL;

-- ============================================
-- 4. Ensure response_tracking table exists
-- ============================================

CREATE TABLE IF NOT EXISTS response_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  original_query TEXT NOT NULL,
  response TEXT NOT NULL,
  route VARCHAR(50),
  assistant_id VARCHAR(255),
  thread_id VARCHAR(255),
  confidence FLOAT,
  corrected BOOLEAN DEFAULT FALSE,
  correction_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create indexes for response_tracking if they don't exist
CREATE INDEX IF NOT EXISTS idx_response_tracking_user_id
ON response_tracking(user_id);

CREATE INDEX IF NOT EXISTS idx_response_tracking_created_at
ON response_tracking(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_response_tracking_corrected
ON response_tracking(corrected)
WHERE corrected = TRUE;

CREATE INDEX IF NOT EXISTS idx_response_tracking_route
ON response_tracking(route);

-- ============================================
-- 5. Create correction analytics view
-- ============================================

CREATE OR REPLACE VIEW correction_analytics AS
SELECT
  rt.route,
  COUNT(DISTINCT rt.id) as total_responses,
  COUNT(DISTINCT CASE WHEN rt.corrected THEN rt.id END) as corrected_responses,
  COUNT(DISTINCT rc.id) as total_corrections,
  COUNT(DISTINCT rc.pattern_id) as patterns_created,
  ROUND(AVG(rt.confidence)::numeric, 2) as avg_confidence,
  ROUND((COUNT(DISTINCT CASE WHEN rt.corrected THEN rt.id END)::float /
         NULLIF(COUNT(DISTINCT rt.id), 0) * 100)::numeric, 2) as correction_rate
FROM response_tracking rt
LEFT JOIN response_corrections rc ON rc.response_id = rt.id
GROUP BY rt.route;

-- ============================================
-- 6. Grant permissions
-- ============================================

-- Grant permissions for the new columns and tables
GRANT SELECT, INSERT, UPDATE ON response_tracking TO authenticated;
GRANT SELECT, INSERT, UPDATE ON response_corrections TO authenticated;
GRANT SELECT ON correction_analytics TO authenticated;

-- ============================================
-- 7. Add helpful comments
-- ============================================

COMMENT ON COLUMN knowledge_store.updated_by IS 'User who last updated this knowledge entry';
COMMENT ON COLUMN decision_patterns.metadata IS 'Additional metadata for the pattern (source, context, etc)';
COMMENT ON COLUMN decision_patterns.last_modified_by IS 'User who last modified this pattern';
COMMENT ON COLUMN decision_patterns.updated_at IS 'Timestamp of last modification';

COMMENT ON TABLE response_corrections IS 'Tracks all corrections made to AI responses';
COMMENT ON TABLE response_tracking IS 'Tracks all AI responses for learning and correction';

-- ============================================
-- 8. Verification
-- ============================================

DO $$
DECLARE
  missing_columns TEXT := '';
  col_exists BOOLEAN;
BEGIN
  -- Check knowledge_store.updated_by
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_store' AND column_name = 'updated_by'
  ) INTO col_exists;
  IF NOT col_exists THEN
    missing_columns := missing_columns || 'knowledge_store.updated_by, ';
  END IF;

  -- Check decision_patterns.metadata
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_patterns' AND column_name = 'metadata'
  ) INTO col_exists;
  IF NOT col_exists THEN
    missing_columns := missing_columns || 'decision_patterns.metadata, ';
  END IF;

  -- Check decision_patterns.last_modified_by
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_patterns' AND column_name = 'last_modified_by'
  ) INTO col_exists;
  IF NOT col_exists THEN
    missing_columns := missing_columns || 'decision_patterns.last_modified_by, ';
  END IF;

  -- Check tables exist
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'response_corrections'
  ) INTO col_exists;
  IF NOT col_exists THEN
    missing_columns := missing_columns || 'response_corrections table, ';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'response_tracking'
  ) INTO col_exists;
  IF NOT col_exists THEN
    missing_columns := missing_columns || 'response_tracking table, ';
  END IF;

  IF missing_columns = '' THEN
    RAISE NOTICE '✅ Corrections schema fix complete - all required columns and tables exist';
  ELSE
    RAISE WARNING '⚠️  Still missing: %', missing_columns;
  END IF;
END $$;