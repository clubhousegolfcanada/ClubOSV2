-- Migration: Add Pattern Safety Controls
-- Description: Adds safety settings for pattern learning system
-- Author: Claude
-- Date: 2025-09-06

-- UP
-- Add new configuration keys for safety controls
INSERT INTO pattern_learning_config (config_key, config_value, description, created_at, updated_at)
VALUES 
  -- Blacklisted topics
  ('blacklist_topics', 'medical,legal,refund,complaint,injury,lawsuit,lawyer,attorney,doctor,emergency,death,suicide,violence', 
   'Comma-separated list of topics that should never trigger auto-response', NOW(), NOW()),
  
  -- Escalation keywords  
  ('escalation_keywords', 'angry,furious,sue,lawyer,attorney,emergency,urgent,injured,hurt,bleeding,unconscious,police,ambulance', 
   'Keywords that immediately notify operator', NOW(), NOW()),
  
  -- Approval requirements
  ('require_approval_for_new', 'true', 
   'Require operator approval for first N uses of new patterns', NOW(), NOW()),
  ('approval_threshold', '10', 
   'Number of uses that require approval for new patterns', NOW(), NOW()),
  
  -- Learning thresholds
  ('min_examples_required', '5', 
   'Minimum similar examples needed before creating a pattern', NOW(), NOW()),
  ('operator_override_weight', '2.0', 
   'Weight multiplier for operator corrections vs auto-learned patterns', NOW(), NOW())
ON CONFLICT (config_key) DO UPDATE 
SET config_value = EXCLUDED.config_value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Add approval tracking to patterns table
ALTER TABLE decision_patterns 
ADD COLUMN IF NOT EXISTS approval_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_operator_override TIMESTAMP,
ADD COLUMN IF NOT EXISTS override_count INTEGER DEFAULT 0;

-- Create table for tracking pattern learning examples
CREATE TABLE IF NOT EXISTS pattern_learning_examples (
  id SERIAL PRIMARY KEY,
  pattern_signature VARCHAR(500) NOT NULL,
  customer_message TEXT NOT NULL,
  operator_response TEXT NOT NULL,
  confidence_score FLOAT DEFAULT 0.5,
  was_modified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  location_id INTEGER,
  
  -- Index for finding similar examples
  INDEX idx_pattern_signature (pattern_signature),
  INDEX idx_created_at (created_at)
);

-- Create table for escalation alerts
CREATE TABLE IF NOT EXISTS pattern_escalation_alerts (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR(255),
  phone_number VARCHAR(50),
  customer_message TEXT,
  triggered_keywords TEXT[],
  alert_type VARCHAR(50), -- 'blacklist' or 'escalation'
  operator_notified BOOLEAN DEFAULT FALSE,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by INTEGER REFERENCES users(id),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_unresolved (resolved, created_at),
  INDEX idx_conversation (conversation_id)
);

-- DOWN
DELETE FROM pattern_learning_config 
WHERE config_key IN (
  'blacklist_topics', 
  'escalation_keywords', 
  'require_approval_for_new', 
  'approval_threshold',
  'min_examples_required',
  'operator_override_weight'
);

ALTER TABLE decision_patterns 
DROP COLUMN IF EXISTS approval_count,
DROP COLUMN IF EXISTS requires_approval,
DROP COLUMN IF EXISTS last_operator_override,
DROP COLUMN IF EXISTS override_count;

DROP TABLE IF EXISTS pattern_learning_examples;
DROP TABLE IF EXISTS pattern_escalation_alerts;