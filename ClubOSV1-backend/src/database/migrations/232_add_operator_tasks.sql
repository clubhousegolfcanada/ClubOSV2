-- Migration: Add operator tasks table for simple task management
-- This creates a lightweight task list for each operator

CREATE TABLE IF NOT EXISTS operator_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  position INTEGER DEFAULT 0
);

-- Index for fast queries by operator
CREATE INDEX idx_operator_tasks_user ON operator_tasks(operator_id, is_completed);
CREATE INDEX idx_operator_tasks_created ON operator_tasks(created_at DESC);