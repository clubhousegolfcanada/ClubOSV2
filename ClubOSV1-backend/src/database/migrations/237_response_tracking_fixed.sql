-- Migration: Add response tracking and improve correction flow
-- Author: Claude
-- Date: 2025-10-03
-- Purpose: Track all AI responses and link corrections to patterns
-- FIXED: Changed v3_pls_patterns to decision_patterns

-- 1. Create response_tracking table to store all AI responses
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

-- 2. Add columns to response_corrections to link with tracking and patterns
ALTER TABLE response_corrections
ADD COLUMN IF NOT EXISTS response_id UUID REFERENCES response_tracking(id),
ADD COLUMN IF NOT EXISTS pattern_id INTEGER REFERENCES decision_patterns(id),
ADD COLUMN IF NOT EXISTS pattern_created BOOLEAN DEFAULT FALSE;

-- 3. Create indexes for efficient searching
CREATE INDEX IF NOT EXISTS idx_response_tracking_user_id ON response_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_response_tracking_created_at ON response_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_response_tracking_corrected ON response_tracking(corrected) WHERE corrected = TRUE;
CREATE INDEX IF NOT EXISTS idx_response_tracking_route ON response_tracking(route);

-- Full-text search index for queries
CREATE INDEX IF NOT EXISTS idx_response_tracking_query_search
ON response_tracking USING gin(to_tsvector('english', original_query));

-- Full-text search index for responses
CREATE INDEX IF NOT EXISTS idx_response_tracking_response_search
ON response_tracking USING gin(to_tsvector('english', response));

-- 4. Create function to automatically update search vectors
CREATE OR REPLACE FUNCTION update_response_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger for updated_at
DROP TRIGGER IF EXISTS update_response_tracking_updated_at_trigger ON response_tracking;
CREATE TRIGGER update_response_tracking_updated_at_trigger
BEFORE UPDATE ON response_tracking
FOR EACH ROW
EXECUTE FUNCTION update_response_tracking_updated_at();

-- 6. Create view for correction analytics
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

-- 7. Create function to link correction with pattern
CREATE OR REPLACE FUNCTION link_correction_to_pattern(
  p_response_id UUID,
  p_pattern_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN := FALSE;
BEGIN
  -- Update the correction record
  UPDATE response_corrections
  SET
    pattern_id = p_pattern_id,
    pattern_created = TRUE
  WHERE response_id = p_response_id;

  -- Mark response as corrected
  UPDATE response_tracking
  SET
    corrected = TRUE,
    correction_count = correction_count + 1
  WHERE id = p_response_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT > 0;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- 8. Grant permissions
GRANT SELECT, INSERT, UPDATE ON response_tracking TO authenticated;
GRANT SELECT ON correction_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION link_correction_to_pattern TO authenticated;

COMMENT ON TABLE response_tracking IS 'Tracks all AI responses for learning and correction';
COMMENT ON COLUMN response_tracking.original_query IS 'The original user query/request';
COMMENT ON COLUMN response_tracking.response IS 'The AI-generated response';
COMMENT ON COLUMN response_tracking.corrected IS 'Whether this response has been corrected by an operator';
COMMENT ON COLUMN response_tracking.correction_count IS 'Number of times this response has been corrected';