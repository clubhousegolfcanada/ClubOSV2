-- Fix Pattern Learning System Tables
-- Corrects type mismatches from original migration

-- Drop tables if they partially exist
DROP TABLE IF EXISTS pattern_learning_config CASCADE;
DROP TABLE IF EXISTS pattern_suggestions_queue CASCADE;
DROP TABLE IF EXISTS pattern_execution_history CASCADE;
DROP TABLE IF EXISTS decision_patterns CASCADE;

-- Main pattern storage table
CREATE TABLE IF NOT EXISTS decision_patterns (
  id SERIAL PRIMARY KEY,
  
  -- Pattern identification
  pattern_type VARCHAR(50) NOT NULL,
  pattern_signature VARCHAR(255) UNIQUE NOT NULL,
  
  -- Pattern content
  trigger_text TEXT,
  trigger_keywords TEXT[],
  response_template TEXT,
  action_template JSONB,
  
  -- Confidence and automation
  confidence_score DECIMAL(3,2) DEFAULT 0.50 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  auto_executable BOOLEAN DEFAULT FALSE,
  requires_confirmation BOOLEAN DEFAULT TRUE,
  
  -- Learning metrics
  execution_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  human_override_count INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  
  -- Temporal data
  first_seen TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP DEFAULT NOW(),
  last_modified TIMESTAMP DEFAULT NOW(),
  
  -- Source tracking
  created_from VARCHAR(50) DEFAULT 'learned',
  created_by UUID REFERENCES users(id), -- Fixed: UUID instead of INTEGER
  
  -- Integration with existing system
  related_feature_key VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Additional metadata
  notes TEXT,
  tags TEXT[],
  
  CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1),
  CONSTRAINT valid_success_rate CHECK (success_count <= execution_count),
  CONSTRAINT valid_failure_rate CHECK (failure_count <= execution_count)
);

-- Pattern execution history
CREATE TABLE IF NOT EXISTS pattern_execution_history (
  id SERIAL PRIMARY KEY,
  pattern_id INTEGER REFERENCES decision_patterns(id) ON DELETE SET NULL,
  
  -- Context
  conversation_id VARCHAR(255),
  phone_number VARCHAR(50),
  customer_name VARCHAR(255),
  
  -- Message details
  message_text TEXT NOT NULL,
  message_timestamp TIMESTAMP,
  
  -- Execution details
  confidence_at_execution DECIMAL(3,2),
  execution_mode VARCHAR(20),
  was_auto_executed BOOLEAN DEFAULT FALSE,
  
  -- Human intervention
  human_approved BOOLEAN,
  human_modified BOOLEAN DEFAULT FALSE,
  human_rejected BOOLEAN DEFAULT FALSE,
  modifications JSONB,
  rejection_reason TEXT,
  
  -- Results
  execution_status VARCHAR(20),
  response_sent TEXT,
  actions_taken JSONB,
  error_details TEXT,
  
  -- Timing
  created_at TIMESTAMP DEFAULT NOW(),
  executed_at TIMESTAMP,
  human_review_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Operator tracking
  reviewed_by UUID REFERENCES users(id), -- Fixed: UUID instead of INTEGER
  operator_notes TEXT,
  
  -- Performance
  response_time_ms INTEGER,
  
  -- Links
  ticket_id UUID, -- Fixed: UUID for ticket references
  slack_thread_ts VARCHAR(255)
);

-- Pattern suggestions queue
CREATE TABLE IF NOT EXISTS pattern_suggestions_queue (
  id SERIAL PRIMARY KEY,
  
  -- The suggested pattern
  pattern_type VARCHAR(50) NOT NULL,
  trigger_text TEXT NOT NULL,
  suggested_response TEXT,
  suggested_actions JSONB,
  
  -- Context from conversation
  conversation_id VARCHAR(255),
  phone_number VARCHAR(50),
  message_timestamp TIMESTAMP,
  full_conversation JSONB,
  
  -- Confidence and reasoning
  confidence_score DECIMAL(3,2) DEFAULT 0.50,
  reasoning TEXT,
  similar_patterns_ids INTEGER[],
  
  -- Review status
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id), -- Fixed: UUID instead of INTEGER
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  
  -- If approved, link to created pattern
  approved_pattern_id INTEGER REFERENCES decision_patterns(id),
  
  -- Tracking
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days'),
  
  -- Source
  suggested_by VARCHAR(50) DEFAULT 'system',
  operator_id UUID REFERENCES users(id) -- Fixed: UUID instead of INTEGER
);

-- Pattern learning configuration
CREATE TABLE IF NOT EXISTS pattern_learning_config (
  config_key VARCHAR(100) PRIMARY KEY,
  config_value TEXT NOT NULL,
  description TEXT,
  last_updated TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) -- Fixed: UUID instead of INTEGER
);

-- Insert default configuration
INSERT INTO pattern_learning_config (config_key, config_value, description) VALUES
('enabled', 'true', 'Enable pattern learning system'),
('shadow_mode', 'true', 'Run in shadow mode (log but don''t execute)'),
('min_confidence_to_suggest', '0.7', 'Minimum confidence to suggest pattern to operator'),
('min_confidence_to_act', '0.95', 'Minimum confidence to auto-execute'),
('min_executions_before_auto', '10', 'Minimum successful executions before allowing auto-execution'),
('require_human_approval', 'true', 'Require human approval for new patterns'),
('pattern_expiry_days', '90', 'Days before unused patterns are archived'),
('max_queue_size', '100', 'Maximum patterns in suggestion queue'),
('batch_learning_enabled', 'true', 'Enable batch learning from conversation history'),
('learning_rate', '0.1', 'How quickly confidence adjusts based on feedback'),
('similarity_threshold', '0.85', 'Threshold for considering patterns similar'),
('enable_regex_migration', 'true', 'Migrate regex patterns to ML patterns')
ON CONFLICT (config_key) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_patterns_signature ON decision_patterns(pattern_signature);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON decision_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON decision_patterns(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_executable ON decision_patterns(auto_executable) WHERE auto_executable = TRUE;
CREATE INDEX IF NOT EXISTS idx_patterns_active ON decision_patterns(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_history_pattern ON pattern_execution_history(pattern_id);
CREATE INDEX IF NOT EXISTS idx_history_conversation ON pattern_execution_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_history_phone ON pattern_execution_history(phone_number);
CREATE INDEX IF NOT EXISTS idx_history_status ON pattern_execution_history(execution_status);
CREATE INDEX IF NOT EXISTS idx_history_created ON pattern_execution_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_queue_status ON pattern_suggestions_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_created ON pattern_suggestions_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_expires ON pattern_suggestions_queue(expires_at);

-- Functions for automated learning
CREATE OR REPLACE FUNCTION update_pattern_confidence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.execution_status = 'success' THEN
    UPDATE decision_patterns 
    SET 
      confidence_score = LEAST(1.0, confidence_score + 0.02),
      success_count = success_count + 1,
      execution_count = execution_count + 1,
      last_used = NOW()
    WHERE id = NEW.pattern_id;
  ELSIF NEW.execution_status = 'failure' THEN
    UPDATE decision_patterns 
    SET 
      confidence_score = GREATEST(0.0, confidence_score - 0.05),
      failure_count = failure_count + 1,
      execution_count = execution_count + 1,
      last_used = NOW()
    WHERE id = NEW.pattern_id;
  ELSIF NEW.human_rejected = TRUE THEN
    UPDATE decision_patterns 
    SET 
      confidence_score = GREATEST(0.0, confidence_score - 0.10),
      human_override_count = human_override_count + 1
    WHERE id = NEW.pattern_id;
  END IF;
  
  -- Check if pattern should be auto-executable
  UPDATE decision_patterns
  SET auto_executable = TRUE
  WHERE id = NEW.pattern_id
    AND confidence_score >= 0.95
    AND success_count >= 10
    AND (failure_count::float / NULLIF(execution_count, 0)) < 0.05;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_confidence') THEN
    CREATE TRIGGER trigger_update_confidence
    AFTER INSERT OR UPDATE ON pattern_execution_history
    FOR EACH ROW
    EXECUTE FUNCTION update_pattern_confidence();
  END IF;
END
$$;

-- Function to find similar patterns
CREATE OR REPLACE FUNCTION find_similar_patterns(search_text TEXT, threshold FLOAT DEFAULT 0.85)
RETURNS TABLE (
  pattern_id INTEGER,
  similarity_score FLOAT,
  pattern_type VARCHAR,
  response_template TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    similarity(trigger_text, search_text) as similarity_score,
    decision_patterns.pattern_type,
    decision_patterns.response_template
  FROM decision_patterns
  WHERE similarity(trigger_text, search_text) > threshold
    AND is_active = TRUE
  ORDER BY similarity_score DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;