-- Migration: Pattern Learning System Fixes
-- Author: Opus 4.1
-- Date: 2025-09-05
-- Purpose: Create missing tables that the code expects but don't exist

-- ============================================
-- CONFIDENCE EVOLUTION TABLE
-- ============================================

-- Tracks how pattern confidence changes over time
CREATE TABLE IF NOT EXISTS confidence_evolution (
  id SERIAL PRIMARY KEY,
  pattern_id INTEGER REFERENCES decision_patterns(id) ON DELETE CASCADE,
  
  -- Confidence change
  old_confidence DECIMAL(3,2) NOT NULL,
  new_confidence DECIMAL(3,2) NOT NULL,
  confidence_delta DECIMAL(3,2) GENERATED ALWAYS AS (new_confidence - old_confidence) STORED,
  
  -- Reason for change
  change_reason VARCHAR(50) NOT NULL, -- 'success', 'failure', 'override', 'decay', 'manual_adjustment', 'import'
  change_details TEXT, -- Additional context
  
  -- Link to execution that caused this change
  execution_id INTEGER REFERENCES pattern_execution_history(id),
  
  -- Metadata
  changed_at TIMESTAMP DEFAULT NOW(),
  changed_by UUID REFERENCES users(id), -- NULL for automatic changes
  
  CONSTRAINT valid_confidence_old CHECK (old_confidence >= 0 AND old_confidence <= 1),
  CONSTRAINT valid_confidence_new CHECK (new_confidence >= 0 AND new_confidence <= 1),
  CONSTRAINT valid_reason CHECK (
    change_reason IN ('success', 'failure', 'override', 'decay', 'manual_adjustment', 'import')
  )
);

-- ============================================
-- OPERATOR ACTIONS TABLE
-- ============================================

-- Records every operator action on pattern suggestions
CREATE TABLE IF NOT EXISTS operator_actions (
  id SERIAL PRIMARY KEY,
  
  -- Reference to the suggestion
  suggestion_id INTEGER REFERENCES pattern_suggestions_queue(id),
  
  -- Operator who took action
  operator_id UUID REFERENCES users(id) NOT NULL,
  
  -- Action details
  action_type VARCHAR(20) NOT NULL, -- 'accept', 'modify', 'reject'
  original_suggestion TEXT,
  final_response TEXT,
  modification_reason TEXT, -- Why operator changed it
  
  -- Pattern reference
  pattern_id INTEGER REFERENCES decision_patterns(id),
  
  -- Timing
  created_at TIMESTAMP DEFAULT NOW(),
  response_time_seconds INTEGER, -- How long operator took to respond
  
  -- Additional context
  conversation_id VARCHAR(255),
  phone_number VARCHAR(50),
  
  CONSTRAINT valid_action CHECK (action_type IN ('accept', 'modify', 'reject'))
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Confidence evolution indexes
CREATE INDEX idx_confidence_evolution_pattern ON confidence_evolution(pattern_id);
CREATE INDEX idx_confidence_evolution_date ON confidence_evolution(changed_at DESC);
CREATE INDEX idx_confidence_evolution_reason ON confidence_evolution(change_reason);

-- Operator actions indexes
CREATE INDEX idx_operator_actions_operator ON operator_actions(operator_id);
CREATE INDEX idx_operator_actions_pattern ON operator_actions(pattern_id);
CREATE INDEX idx_operator_actions_date ON operator_actions(created_at DESC);
CREATE INDEX idx_operator_actions_type ON operator_actions(action_type);
CREATE INDEX idx_operator_actions_suggestion ON operator_actions(suggestion_id);

-- ============================================
-- FIX EXISTING TABLES
-- ============================================

-- Add missing columns to pattern_execution_history if they don't exist
DO $$ 
BEGIN
  -- Add gpt4o_reasoning column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pattern_execution_history' 
    AND column_name = 'gpt4o_reasoning'
  ) THEN
    ALTER TABLE pattern_execution_history 
    ADD COLUMN gpt4o_reasoning JSONB;
  END IF;

  -- Add learning_applied column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pattern_execution_history' 
    AND column_name = 'learning_applied'
  ) THEN
    ALTER TABLE pattern_execution_history 
    ADD COLUMN learning_applied BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- ============================================
-- STORED PROCEDURES FOR PATTERN UPDATES
-- ============================================

-- Function to properly update pattern statistics
CREATE OR REPLACE FUNCTION update_pattern_statistics(
  p_pattern_id INTEGER,
  p_was_successful BOOLEAN,
  p_was_modified BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
BEGIN
  UPDATE decision_patterns
  SET 
    execution_count = execution_count + 1,
    success_count = CASE 
      WHEN p_was_successful AND NOT p_was_modified THEN success_count + 1 
      ELSE success_count 
    END,
    human_override_count = CASE 
      WHEN p_was_modified THEN human_override_count + 1 
      ELSE human_override_count 
    END,
    last_used = NOW(),
    last_modified = CASE
      WHEN p_was_modified THEN NOW()
      ELSE last_modified
    END
  WHERE id = p_pattern_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update confidence with tracking
CREATE OR REPLACE FUNCTION update_pattern_confidence_tracked(
  p_pattern_id INTEGER,
  p_confidence_change DECIMAL,
  p_change_reason VARCHAR(50),
  p_execution_id INTEGER DEFAULT NULL,
  p_changed_by UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_old_confidence DECIMAL(3,2);
  v_new_confidence DECIMAL(3,2);
BEGIN
  -- Get current confidence
  SELECT confidence_score INTO v_old_confidence
  FROM decision_patterns
  WHERE id = p_pattern_id;
  
  -- Calculate new confidence (bounded 0-1)
  v_new_confidence := GREATEST(0, LEAST(1, v_old_confidence + p_confidence_change));
  
  -- Update the pattern
  UPDATE decision_patterns
  SET confidence_score = v_new_confidence,
      auto_executable = CASE 
        WHEN v_new_confidence >= 0.95 AND execution_count >= 20 THEN TRUE
        ELSE auto_executable
      END
  WHERE id = p_pattern_id;
  
  -- Record the change
  INSERT INTO confidence_evolution (
    pattern_id, 
    old_confidence, 
    new_confidence, 
    change_reason, 
    execution_id,
    changed_by
  ) VALUES (
    p_pattern_id,
    v_old_confidence,
    v_new_confidence,
    p_change_reason,
    p_execution_id,
    p_changed_by
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE ON confidence_evolution TO authenticated;
GRANT SELECT, INSERT, UPDATE ON operator_actions TO authenticated;
GRANT EXECUTE ON FUNCTION update_pattern_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION update_pattern_confidence_tracked TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify tables were created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'confidence_evolution') THEN
    RAISE NOTICE 'Successfully created confidence_evolution table';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operator_actions') THEN
    RAISE NOTICE 'Successfully created operator_actions table';
  END IF;
END $$;