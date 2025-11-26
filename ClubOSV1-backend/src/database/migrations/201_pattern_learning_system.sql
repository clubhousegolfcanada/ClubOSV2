-- Migration: Pattern Learning System for V1
-- Author: Claude
-- Date: 2025-09-01
-- Purpose: Add V3's pattern learning capabilities to V1 without breaking existing functionality
-- BREADCRUMB: This is the foundation for the pattern learning system

-- ============================================
-- PATTERN LEARNING TABLES
-- ============================================

-- Main pattern storage table
-- This stores all learned patterns from customer interactions
CREATE TABLE IF NOT EXISTS decision_patterns (
  id SERIAL PRIMARY KEY,
  
  -- Pattern identification
  pattern_type VARCHAR(50) NOT NULL, -- 'booking', 'tech_issue', 'access', 'faq', 'gift_cards', 'hours'
  pattern_signature VARCHAR(255) UNIQUE NOT NULL, -- MD5 hash of normalized pattern for quick lookup
  
  -- Pattern content
  trigger_text TEXT, -- Original customer message that created this pattern
  trigger_keywords TEXT[], -- Extracted keywords for faster searching
  response_template TEXT, -- Template response (can include variables like {{customer_name}})
  action_template JSONB, -- Actions to take (e.g., {"type": "reset_trackman", "bay": 3})
  
  -- Confidence and automation
  confidence_score DECIMAL(3,2) DEFAULT 0.50 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  auto_executable BOOLEAN DEFAULT FALSE, -- True when confidence >= 0.95
  requires_confirmation BOOLEAN DEFAULT TRUE, -- False when pattern is fully trusted
  
  -- Learning metrics
  execution_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  human_override_count INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER, -- Average time to execute this pattern
  
  -- Temporal data
  first_seen TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP DEFAULT NOW(),
  last_modified TIMESTAMP DEFAULT NOW(),
  
  -- Source tracking
  created_from VARCHAR(50) DEFAULT 'learned', -- 'manual', 'learned', 'imported', 'regex_migration'
  created_by INTEGER REFERENCES users(id), -- Who created/approved this pattern
  
  -- Integration with existing system
  related_feature_key VARCHAR(100), -- Links to ai_automation_features if migrated from regex
  is_active BOOLEAN DEFAULT TRUE, -- Can be disabled without deleting
  
  -- Additional metadata
  notes TEXT, -- Human notes about this pattern
  tags TEXT[], -- For categorization and search
  
  CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1),
  CONSTRAINT valid_success_rate CHECK (success_count <= execution_count),
  CONSTRAINT valid_failure_rate CHECK (failure_count <= execution_count)
);

-- Pattern execution history
-- Tracks every time a pattern is used (or could have been used)
CREATE TABLE IF NOT EXISTS pattern_execution_history (
  id SERIAL PRIMARY KEY,
  pattern_id INTEGER REFERENCES decision_patterns(id) ON DELETE SET NULL,
  
  -- Context
  conversation_id VARCHAR(255), -- OpenPhone conversation ID
  phone_number VARCHAR(50),
  customer_name VARCHAR(255),
  
  -- Message details
  message_text TEXT NOT NULL, -- The actual customer message
  message_timestamp TIMESTAMP,
  
  -- Execution details
  confidence_at_execution DECIMAL(3,2),
  execution_mode VARCHAR(20), -- 'auto', 'suggested', 'queued', 'shadow', 'manual'
  was_auto_executed BOOLEAN DEFAULT FALSE,
  
  -- Human intervention
  human_approved BOOLEAN,
  human_modified BOOLEAN DEFAULT FALSE,
  human_rejected BOOLEAN DEFAULT FALSE,
  modifications JSONB, -- What was changed {"response": "new text", "actions": [...]}
  rejection_reason TEXT,
  
  -- Results
  execution_status VARCHAR(20), -- 'success', 'failure', 'modified', 'cancelled', 'pending'
  response_sent TEXT, -- Actual response sent to customer
  actions_taken JSONB, -- Actual actions executed
  error_details TEXT, -- If something went wrong
  
  -- Timing
  created_at TIMESTAMP DEFAULT NOW(),
  executed_at TIMESTAMP,
  human_review_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Operator tracking
  reviewed_by INTEGER REFERENCES users(id),
  
  CONSTRAINT valid_execution_status CHECK (
    execution_status IN ('success', 'failure', 'modified', 'cancelled', 'pending', 'shadow')
  )
);

-- Confidence evolution tracking
-- Tracks how pattern confidence changes over time
CREATE TABLE IF NOT EXISTS confidence_evolution (
  id SERIAL PRIMARY KEY,
  pattern_id INTEGER REFERENCES decision_patterns(id) ON DELETE CASCADE,
  
  -- Confidence change
  old_confidence DECIMAL(3,2) NOT NULL,
  new_confidence DECIMAL(3,2) NOT NULL,
  confidence_delta DECIMAL(3,2) GENERATED ALWAYS AS (new_confidence - old_confidence) STORED,
  
  -- Reason for change
  change_reason VARCHAR(50) NOT NULL, -- 'success', 'failure', 'override', 'decay', 'manual_adjustment'
  change_details TEXT, -- Additional context
  
  -- Link to execution that caused this change
  execution_id INTEGER REFERENCES pattern_execution_history(id),
  
  -- Metadata
  changed_at TIMESTAMP DEFAULT NOW(),
  changed_by INTEGER REFERENCES users(id), -- NULL for automatic changes
  
  CONSTRAINT valid_reason CHECK (
    change_reason IN ('success', 'failure', 'override', 'decay', 'manual_adjustment', 'import')
  )
);

-- Pattern suggestions queue
-- Patterns waiting for human approval when confidence is medium (0.50-0.94)
CREATE TABLE IF NOT EXISTS pattern_suggestions_queue (
  id SERIAL PRIMARY KEY,
  pattern_id INTEGER REFERENCES decision_patterns(id),
  execution_history_id INTEGER REFERENCES pattern_execution_history(id),
  
  -- Suggestion details
  suggested_response TEXT NOT NULL,
  suggested_actions JSONB,
  confidence_score DECIMAL(3,2) NOT NULL,
  
  -- Queue management
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'timeout', 'modified'
  priority INTEGER DEFAULT 5, -- 1-10, higher = more urgent
  expires_at TIMESTAMP, -- Auto-reject after this time
  
  -- Review tracking
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'approved', 'rejected', 'timeout', 'modified')
  )
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Pattern lookup indexes
CREATE INDEX idx_patterns_type ON decision_patterns(pattern_type);
CREATE INDEX idx_patterns_confidence ON decision_patterns(confidence_score DESC);
CREATE INDEX idx_patterns_auto ON decision_patterns(auto_executable);
CREATE INDEX idx_patterns_active ON decision_patterns(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_patterns_signature ON decision_patterns(pattern_signature);
CREATE INDEX idx_patterns_keywords ON decision_patterns USING GIN(trigger_keywords);

-- Execution history indexes
CREATE INDEX idx_execution_conversation ON pattern_execution_history(conversation_id);
CREATE INDEX idx_execution_phone ON pattern_execution_history(phone_number);
CREATE INDEX idx_execution_status ON pattern_execution_history(execution_status);
CREATE INDEX idx_execution_created ON pattern_execution_history(created_at DESC);
CREATE INDEX idx_execution_pattern ON pattern_execution_history(pattern_id);

-- Queue indexes
CREATE INDEX idx_queue_status ON pattern_suggestions_queue(status) WHERE status = 'pending';
CREATE INDEX idx_queue_expires ON pattern_suggestions_queue(expires_at) WHERE status = 'pending';
CREATE INDEX idx_queue_priority ON pattern_suggestions_queue(priority DESC) WHERE status = 'pending';

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate pattern success rate
CREATE OR REPLACE FUNCTION calculate_pattern_success_rate(p_pattern_id INTEGER)
RETURNS DECIMAL AS $$
DECLARE
  v_success_count INTEGER;
  v_total_count INTEGER;
BEGIN
  SELECT success_count, execution_count 
  INTO v_success_count, v_total_count
  FROM decision_patterns 
  WHERE id = p_pattern_id;
  
  IF v_total_count = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND((v_success_count::DECIMAL / v_total_count::DECIMAL), 2);
END;
$$ LANGUAGE plpgsql;

-- Function to promote pattern to auto-executable
CREATE OR REPLACE FUNCTION promote_pattern_to_auto_executable(p_pattern_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_pattern RECORD;
BEGIN
  SELECT * INTO v_pattern
  FROM decision_patterns
  WHERE id = p_pattern_id;
  
  -- Promotion criteria:
  -- 1. Confidence >= 0.95
  -- 2. At least 20 successful executions
  -- 3. Success rate >= 90%
  -- 4. No overrides in last 10 executions
  IF v_pattern.confidence_score >= 0.95 
     AND v_pattern.success_count >= 20
     AND calculate_pattern_success_rate(p_pattern_id) >= 0.90
     AND NOT EXISTS (
       SELECT 1 FROM pattern_execution_history
       WHERE pattern_id = p_pattern_id
       AND human_modified = TRUE
       ORDER BY created_at DESC
       LIMIT 10
     ) THEN
    
    UPDATE decision_patterns
    SET auto_executable = TRUE,
        requires_confirmation = FALSE
    WHERE id = p_pattern_id;
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CONFIGURATION TABLE
-- ============================================

-- Pattern learning configuration
CREATE TABLE IF NOT EXISTS pattern_learning_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO pattern_learning_config (config_key, config_value, description) VALUES
('enabled', 'false', 'Master switch for pattern learning system'),
('shadow_mode', 'true', 'Run in shadow mode (log but don''t execute)'),
('auto_execute_threshold', '0.95', 'Minimum confidence for auto-execution'),
('suggest_threshold', '0.75', 'Minimum confidence for suggestions'),
('queue_threshold', '0.50', 'Minimum confidence to queue for approval'),
('confidence_increase_success', '0.05', 'Confidence increase on success'),
('confidence_increase_modified', '0.02', 'Confidence increase when modified but approved'),
('confidence_decrease_failure', '0.10', 'Confidence decrease on failure'),
('confidence_decay_daily', '0.01', 'Daily decay for unused patterns'),
('suggestion_timeout_seconds', '30', 'Seconds before suggestion auto-executes'),
('min_executions_for_auto', '20', 'Minimum executions before auto-executable'),
('import_historical_data', 'false', 'Whether to import historical conversations')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================
-- BREADCRUMBS & NEXT STEPS
-- ============================================

-- BREADCRUMB: Migration created successfully
-- Migration has been run in production - V3-PLS is active
-- NOTE: System starts in shadow_mode = true, so it won't affect production until we're ready