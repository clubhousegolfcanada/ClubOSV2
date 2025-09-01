-- Pattern Optimization Tables
-- Adds missing functionality for maximum pattern learning effectiveness

-- Table for storing alternative phrasings of patterns
CREATE TABLE IF NOT EXISTS pattern_alternatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id INTEGER REFERENCES decision_patterns(id) ON DELETE CASCADE,
  alternative_text TEXT NOT NULL,
  alternative_response TEXT,
  context JSONB DEFAULT '{}',
  frequency INTEGER DEFAULT 1,
  last_seen TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(pattern_id, alternative_text)
);

-- Table for operator feedback on patterns
CREATE TABLE IF NOT EXISTS pattern_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id INTEGER REFERENCES decision_patterns(id) ON DELETE CASCADE,
  operator_id INTEGER,
  feedback_type VARCHAR(20) CHECK (feedback_type IN ('approve', 'reject', 'improve')),
  suggestion TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table for voided interactions (shouldn't be learned from)
CREATE TABLE IF NOT EXISTS voided_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(255),
  message_id VARCHAR(255),
  void_reason VARCHAR(50),
  voided_by INTEGER,
  quality_score DECIMAL(3,2),
  issues TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table for gold standard interactions (best examples)
CREATE TABLE IF NOT EXISTS gold_standard_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(255) NOT NULL,
  customer_message TEXT NOT NULL,
  operator_response TEXT NOT NULL,
  category VARCHAR(50),
  tags TEXT[],
  marked_by INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table for pattern performance metrics
CREATE TABLE IF NOT EXISTS pattern_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id INTEGER REFERENCES decision_patterns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  execution_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  override_count INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  customer_satisfaction_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(pattern_id, date)
);

-- Table for pattern clusters (grouped similar patterns)
CREATE TABLE IF NOT EXISTS pattern_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_name VARCHAR(255),
  primary_pattern_id INTEGER REFERENCES decision_patterns(id),
  member_pattern_ids INTEGER[],
  cluster_confidence DECIMAL(3,2),
  total_executions INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table for context variables used in patterns
CREATE TABLE IF NOT EXISTS pattern_context_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variable_name VARCHAR(100) UNIQUE NOT NULL,
  variable_type VARCHAR(50),
  data_source VARCHAR(255),
  default_value TEXT,
  is_dynamic BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add new columns to existing decision_patterns table
ALTER TABLE decision_patterns 
ADD COLUMN IF NOT EXISTS quality_score DECIMAL(3,2) DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS is_gold_standard BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS human_feedback_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_decay_applied TIMESTAMP,
ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES pattern_clusters(id),
ADD COLUMN IF NOT EXISTS context_variables JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS alternative_count INTEGER DEFAULT 0;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_pattern_alternatives_pattern_id ON pattern_alternatives(pattern_id);
CREATE INDEX IF NOT EXISTS idx_pattern_alternatives_frequency ON pattern_alternatives(frequency DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_feedback_pattern_id ON pattern_feedback(pattern_id);
CREATE INDEX IF NOT EXISTS idx_pattern_feedback_created ON pattern_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voided_interactions_conversation ON voided_interactions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_gold_standard_category ON gold_standard_interactions(category);
CREATE INDEX IF NOT EXISTS idx_pattern_performance_date ON pattern_performance_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_clusters_primary ON pattern_clusters(primary_pattern_id);

-- Function to calculate pattern effectiveness score
CREATE OR REPLACE FUNCTION calculate_pattern_effectiveness(p_pattern_id INTEGER)
RETURNS DECIMAL AS $$
DECLARE
  effectiveness DECIMAL;
  success_rate DECIMAL;
  usage_rate DECIMAL;
  feedback_score DECIMAL;
BEGIN
  -- Calculate success rate
  SELECT 
    COALESCE(AVG(CASE WHEN was_successful THEN 1 ELSE 0 END), 0.5)
  INTO success_rate
  FROM pattern_execution_history
  WHERE pattern_id = p_pattern_id
    AND executed_at > NOW() - INTERVAL '30 days';
  
  -- Calculate usage rate (normalized)
  SELECT 
    LEAST(1.0, COUNT(*)::DECIMAL / 100)
  INTO usage_rate
  FROM pattern_execution_history
  WHERE pattern_id = p_pattern_id
    AND executed_at > NOW() - INTERVAL '30 days';
  
  -- Calculate feedback score
  SELECT 
    COALESCE(AVG(CASE 
      WHEN feedback_type = 'approve' THEN 1.0
      WHEN feedback_type = 'improve' THEN 0.5
      WHEN feedback_type = 'reject' THEN 0.0
    END), 0.5)
  INTO feedback_score
  FROM pattern_feedback
  WHERE pattern_id = p_pattern_id
    AND created_at > NOW() - INTERVAL '30 days';
  
  -- Weighted effectiveness score
  effectiveness := (success_rate * 0.4) + (usage_rate * 0.3) + (feedback_score * 0.3);
  
  RETURN effectiveness;
END;
$$ LANGUAGE plpgsql;

-- Function to find similar patterns for clustering
CREATE OR REPLACE FUNCTION find_similar_patterns(p_pattern_id INTEGER, p_threshold DECIMAL DEFAULT 0.7)
RETURNS TABLE(pattern_id INTEGER, similarity_score DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p2.id as pattern_id,
    -- Simple similarity based on keyword overlap
    (
      SELECT COUNT(*)::DECIMAL / GREATEST(
        array_length(p1.trigger_keywords, 1),
        array_length(p2.trigger_keywords, 1)
      )
      FROM unnest(p1.trigger_keywords) AS k1
      JOIN unnest(p2.trigger_keywords) AS k2 ON k1 = k2
    ) as similarity_score
  FROM decision_patterns p1, decision_patterns p2
  WHERE p1.id = p_pattern_id
    AND p2.id != p_pattern_id
    AND p2.pattern_type = p1.pattern_type
    AND p2.is_active = true
  HAVING similarity_score >= p_threshold
  ORDER BY similarity_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update pattern alternative count
CREATE OR REPLACE FUNCTION update_alternative_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE decision_patterns
  SET alternative_count = (
    SELECT COUNT(*) 
    FROM pattern_alternatives 
    WHERE pattern_id = NEW.pattern_id
  )
  WHERE id = NEW.pattern_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_alternative_count
AFTER INSERT OR DELETE ON pattern_alternatives
FOR EACH ROW
EXECUTE FUNCTION update_alternative_count();

-- Initial data for context variables
INSERT INTO pattern_context_variables (variable_name, variable_type, data_source, is_dynamic)
VALUES 
  ('customer_name', 'string', 'conversation.customer_name', false),
  ('current_time', 'datetime', 'system.now()', true),
  ('next_available_slot', 'datetime', 'booking.nextAvailable()', true),
  ('wait_time_minutes', 'number', 'queue.currentWait()', true),
  ('booking_link', 'url', 'config.booking_url', false),
  ('business_hours', 'string', 'config.hours', false),
  ('operator_name', 'string', 'user.name', false)
ON CONFLICT (variable_name) DO NOTHING;