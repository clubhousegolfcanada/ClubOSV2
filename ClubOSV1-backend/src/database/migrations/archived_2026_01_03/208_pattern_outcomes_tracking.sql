-- Migration: Add pattern outcomes tracking table
-- Created: 2025-09-05
-- Purpose: Track customer reactions and pattern effectiveness

-- Create pattern_outcomes table
CREATE TABLE IF NOT EXISTS pattern_outcomes (
  id SERIAL PRIMARY KEY,
  execution_id INTEGER REFERENCES pattern_execution_history(id),
  pattern_id INTEGER REFERENCES decision_patterns(id),
  conversation_id VARCHAR(255),
  
  -- Customer reaction tracking
  customer_replied BOOLEAN DEFAULT false,
  reply_sentiment VARCHAR(20), -- positive, negative, neutral, confused
  reply_text TEXT,
  reply_timestamp TIMESTAMP,
  
  -- Resolution tracking
  operator_intervened BOOLEAN DEFAULT false,
  operator_intervention_time TIMESTAMP,
  issue_resolved BOOLEAN,
  resolution_method VARCHAR(50), -- auto, operator, escalated, abandoned
  
  -- Performance metrics
  time_to_first_reply INTEGER, -- seconds until customer replied
  time_to_resolution INTEGER, -- seconds until issue resolved
  messages_exchanged INTEGER DEFAULT 1,
  
  -- Learning signals
  pattern_was_helpful BOOLEAN,
  required_clarification BOOLEAN DEFAULT false,
  customer_satisfied BOOLEAN,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for queries
CREATE INDEX IF NOT EXISTS idx_pattern_outcomes_pattern_id ON pattern_outcomes(pattern_id);
CREATE INDEX IF NOT EXISTS idx_pattern_outcomes_execution_id ON pattern_outcomes(execution_id);
CREATE INDEX IF NOT EXISTS idx_pattern_outcomes_conversation_id ON pattern_outcomes(conversation_id);
CREATE INDEX IF NOT EXISTS idx_pattern_outcomes_created_at ON pattern_outcomes(created_at DESC);

-- Create function to analyze pattern effectiveness
CREATE OR REPLACE FUNCTION calculate_pattern_effectiveness(p_pattern_id INTEGER)
RETURNS TABLE (
  total_uses INTEGER,
  successful_resolutions INTEGER,
  success_rate DECIMAL(5,2),
  avg_time_to_resolution INTEGER,
  positive_sentiment_rate DECIMAL(5,2),
  requires_intervention_rate DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_uses,
    COUNT(*) FILTER (WHERE issue_resolved = true)::INTEGER as successful_resolutions,
    ROUND(COUNT(*) FILTER (WHERE issue_resolved = true)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as success_rate,
    AVG(time_to_resolution) FILTER (WHERE time_to_resolution IS NOT NULL)::INTEGER as avg_time_to_resolution,
    ROUND(COUNT(*) FILTER (WHERE reply_sentiment = 'positive')::DECIMAL / 
          NULLIF(COUNT(*) FILTER (WHERE reply_sentiment IS NOT NULL), 0) * 100, 2) as positive_sentiment_rate,
    ROUND(COUNT(*) FILTER (WHERE operator_intervened = true)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as requires_intervention_rate
  FROM pattern_outcomes
  WHERE pattern_id = p_pattern_id
    AND created_at > NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update pattern confidence based on outcomes
CREATE OR REPLACE FUNCTION update_pattern_confidence_from_outcomes()
RETURNS TRIGGER AS $$
DECLARE
  v_effectiveness RECORD;
  v_new_confidence DECIMAL(3,2);
BEGIN
  -- Only process after outcome is complete
  IF NEW.issue_resolved IS NOT NULL THEN
    -- Get pattern effectiveness
    SELECT * INTO v_effectiveness 
    FROM calculate_pattern_effectiveness(NEW.pattern_id);
    
    -- Calculate new confidence based on effectiveness
    IF v_effectiveness.total_uses >= 5 THEN
      -- Base confidence on success rate
      v_new_confidence := LEAST(0.95, GREATEST(0.1, 
        v_effectiveness.success_rate / 100.0 * 
        (1 - v_effectiveness.requires_intervention_rate / 100.0)
      ));
      
      -- Update pattern confidence
      UPDATE decision_patterns 
      SET confidence_score = v_new_confidence,
          last_modified = NOW()
      WHERE id = NEW.pattern_id;
      
      -- Log confidence change
      INSERT INTO confidence_evolution 
      (pattern_id, old_confidence, new_confidence, change_reason, changed_at, changed_by)
      SELECT 
        NEW.pattern_id,
        confidence_score,
        v_new_confidence,
        'outcome_based_adjustment',
        NOW(),
        'system'
      FROM decision_patterns
      WHERE id = NEW.pattern_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trg_update_pattern_confidence_from_outcomes
AFTER INSERT OR UPDATE ON pattern_outcomes
FOR EACH ROW
EXECUTE FUNCTION update_pattern_confidence_from_outcomes();

-- Add comment
COMMENT ON TABLE pattern_outcomes IS 'Tracks the effectiveness and outcomes of pattern executions for continuous learning';