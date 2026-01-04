-- Migration: Pattern Import Staging System
-- Description: Creates staging table for imported patterns requiring approval
-- Author: ClubOS Team
-- Date: 2025-01-09

-- Create staging table for imported patterns
CREATE TABLE IF NOT EXISTS pattern_import_staging (
  id SERIAL PRIMARY KEY,
  import_job_id UUID,
  
  -- Pattern data (mirrors decision_patterns structure)
  pattern_type VARCHAR(50) NOT NULL,
  trigger_text TEXT,
  response_template TEXT NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0.60,
  trigger_examples TEXT[],
  trigger_keywords TEXT[],
  template_variables JSONB,
  
  -- Additional context for review
  conversation_preview TEXT, -- Original conversation that generated this pattern
  conversation_metadata JSONB, -- Phone numbers, timestamps, etc.
  
  -- Approval workflow fields
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, edited
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  
  -- Edit tracking
  original_trigger TEXT, -- Store original before edits
  original_response TEXT, -- Store original before edits
  edited_by UUID REFERENCES users(id),
  edited_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for performance
  INDEX idx_staging_job_id (import_job_id),
  INDEX idx_staging_status (status),
  INDEX idx_staging_created (created_at DESC)
);

-- Add staging tracking columns to import jobs table
ALTER TABLE pattern_import_jobs 
ADD COLUMN IF NOT EXISTS patterns_staged INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS patterns_approved INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS patterns_rejected INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS review_completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS review_completed_by UUID REFERENCES users(id);

-- Create function to move approved patterns to main table
CREATE OR REPLACE FUNCTION approve_staged_patterns(
  pattern_ids INTEGER[],
  user_id UUID
) RETURNS TABLE (
  approved_count INTEGER,
  failed_count INTEGER
) AS $$
DECLARE
  approved_counter INTEGER := 0;
  failed_counter INTEGER := 0;
  staged_pattern RECORD;
BEGIN
  -- Process each pattern
  FOR staged_pattern IN 
    SELECT * FROM pattern_import_staging 
    WHERE id = ANY(pattern_ids) AND status = 'pending'
  LOOP
    BEGIN
      -- Insert into decision_patterns
      INSERT INTO decision_patterns (
        pattern_type,
        pattern_signature,
        trigger_text,
        trigger_keywords,
        response_template,
        trigger_examples,
        template_variables,
        confidence_score,
        auto_executable,
        execution_count,
        success_count,
        is_active,
        learned_from,
        created_at
      ) VALUES (
        staged_pattern.pattern_type,
        MD5(staged_pattern.trigger_text || staged_pattern.response_template),
        staged_pattern.trigger_text,
        staged_pattern.trigger_keywords,
        staged_pattern.response_template,
        staged_pattern.trigger_examples,
        staged_pattern.template_variables,
        staged_pattern.confidence_score,
        FALSE, -- Never auto-executable initially
        0,
        0,
        FALSE, -- Start inactive, admin must activate
        'csv_import_approved',
        NOW()
      );
      
      -- Update staging record
      UPDATE pattern_import_staging 
      SET 
        status = 'approved',
        reviewed_by = user_id,
        reviewed_at = NOW()
      WHERE id = staged_pattern.id;
      
      approved_counter := approved_counter + 1;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue processing
      UPDATE pattern_import_staging 
      SET 
        status = 'rejected',
        review_notes = 'Failed to create pattern: ' || SQLERRM,
        reviewed_by = user_id,
        reviewed_at = NOW()
      WHERE id = staged_pattern.id;
      
      failed_counter := failed_counter + 1;
    END;
  END LOOP;
  
  -- Update job statistics
  UPDATE pattern_import_jobs j
  SET 
    patterns_approved = patterns_approved + approved_counter,
    review_completed = (
      SELECT COUNT(*) = 0 
      FROM pattern_import_staging s 
      WHERE s.import_job_id = j.id AND s.status = 'pending'
    ),
    review_completed_at = CASE 
      WHEN (
        SELECT COUNT(*) = 0 
        FROM pattern_import_staging s 
        WHERE s.import_job_id = j.id AND s.status = 'pending'
      ) THEN NOW() 
      ELSE NULL 
    END,
    review_completed_by = user_id
  WHERE id IN (
    SELECT DISTINCT import_job_id 
    FROM pattern_import_staging 
    WHERE id = ANY(pattern_ids)
  );
  
  RETURN QUERY SELECT approved_counter, failed_counter;
END;
$$ LANGUAGE plpgsql;

-- Create function to reject patterns
CREATE OR REPLACE FUNCTION reject_staged_patterns(
  pattern_ids INTEGER[],
  user_id UUID,
  reason TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  rejected_count INTEGER;
BEGIN
  UPDATE pattern_import_staging
  SET 
    status = 'rejected',
    reviewed_by = user_id,
    reviewed_at = NOW(),
    review_notes = reason
  WHERE id = ANY(pattern_ids) AND status = 'pending';
  
  GET DIAGNOSTICS rejected_count = ROW_COUNT;
  
  -- Update job statistics
  UPDATE pattern_import_jobs j
  SET 
    patterns_rejected = patterns_rejected + rejected_count,
    review_completed = (
      SELECT COUNT(*) = 0 
      FROM pattern_import_staging s 
      WHERE s.import_job_id = j.id AND s.status = 'pending'
    ),
    review_completed_at = CASE 
      WHEN (
        SELECT COUNT(*) = 0 
        FROM pattern_import_staging s 
        WHERE s.import_job_id = j.id AND s.status = 'pending'
      ) THEN NOW() 
      ELSE NULL 
    END,
    review_completed_by = user_id
  WHERE id IN (
    SELECT DISTINCT import_job_id 
    FROM pattern_import_staging 
    WHERE id = ANY(pattern_ids)
  );
  
  RETURN rejected_count;
END;
$$ LANGUAGE plpgsql;

-- Create view for easy pattern review
CREATE OR REPLACE VIEW pattern_staging_review AS
SELECT 
  ps.*,
  pij.user_id as imported_by,
  u1.name as imported_by_name,
  u2.name as reviewed_by_name,
  pij.started_at as import_date,
  CASE 
    WHEN ps.status = 'pending' THEN 'Awaiting Review'
    WHEN ps.status = 'approved' THEN 'Approved'
    WHEN ps.status = 'rejected' THEN 'Rejected'
    WHEN ps.status = 'edited' THEN 'Edited & Pending'
  END as status_label
FROM pattern_import_staging ps
LEFT JOIN pattern_import_jobs pij ON ps.import_job_id = pij.id
LEFT JOIN users u1 ON pij.user_id = u1.id
LEFT JOIN users u2 ON ps.reviewed_by = u2.id
ORDER BY ps.created_at DESC;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON pattern_import_staging TO authenticated;
GRANT SELECT ON pattern_staging_review TO authenticated;
GRANT EXECUTE ON FUNCTION approve_staged_patterns TO authenticated;
GRANT EXECUTE ON FUNCTION reject_staged_patterns TO authenticated;

-- Add helpful comments
COMMENT ON TABLE pattern_import_staging IS 'Staging area for imported patterns requiring admin approval before going live';
COMMENT ON COLUMN pattern_import_staging.status IS 'pending: awaiting review, approved: moved to main table, rejected: declined, edited: modified and pending re-review';
COMMENT ON COLUMN pattern_import_staging.conversation_preview IS 'Original conversation text for context during review';
COMMENT ON FUNCTION approve_staged_patterns IS 'Moves approved patterns from staging to production decision_patterns table';
COMMENT ON FUNCTION reject_staged_patterns IS 'Marks patterns as rejected with optional reason';