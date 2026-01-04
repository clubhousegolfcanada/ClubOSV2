-- Migration 354: Action Events Table
-- Purpose: Unified action log for correlation with conversations
-- Part of V3-PLS Enhanced Learning System (Phase 1)
-- Created: 2026-01-04

-- UP
CREATE TABLE IF NOT EXISTS action_events (
  id SERIAL PRIMARY KEY,

  -- Action identification
  action_type VARCHAR(50) NOT NULL,
  action_source VARCHAR(50) NOT NULL,

  -- Correlation fields (link to conversations)
  phone_number VARCHAR(50),
  conversation_id VARCHAR(255),

  -- Operator tracking
  operator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  operator_name VARCHAR(255),

  -- Action details
  action_params JSONB DEFAULT '{}',
  action_result JSONB DEFAULT '{}',
  success BOOLEAN DEFAULT TRUE,

  -- Timing
  created_at TIMESTAMP DEFAULT NOW(),
  duration_ms INTEGER,

  CONSTRAINT valid_action_type CHECK (
    action_type IN (
      'door_unlock',
      'device_reset',
      'device_session',
      'ticket_create',
      'ticket_update',
      'ticket_close',
      'booking_create',
      'booking_update',
      'booking_cancel',
      'message_send',
      'pattern_execute',
      'escalation'
    )
  ),
  CONSTRAINT valid_action_source CHECK (
    action_source IN (
      'unifi',
      'ninjaone',
      'splashtop',
      'tickets',
      'booking',
      'openphone',
      'v3pls',
      'manual'
    )
  )
);

-- Indexes for efficient correlation queries
CREATE INDEX IF NOT EXISTS idx_action_events_phone
  ON action_events(phone_number);

CREATE INDEX IF NOT EXISTS idx_action_events_time
  ON action_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_events_type
  ON action_events(action_type);

CREATE INDEX IF NOT EXISTS idx_action_events_operator
  ON action_events(operator_id);

CREATE INDEX IF NOT EXISTS idx_action_events_source
  ON action_events(action_source);

-- Composite index for conversation correlation
CREATE INDEX IF NOT EXISTS idx_action_events_correlation
  ON action_events(phone_number, created_at DESC)
  WHERE phone_number IS NOT NULL;

-- Composite index for recent actions by operator
CREATE INDEX IF NOT EXISTS idx_action_events_operator_recent
  ON action_events(operator_id, created_at DESC)
  WHERE operator_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE action_events IS 'Unified action log for V3-PLS situation-based learning. Captures all operator actions for correlation with customer conversations.';

COMMENT ON COLUMN action_events.action_type IS 'Type of action: door_unlock, device_reset, device_session, ticket_create, etc.';
COMMENT ON COLUMN action_events.action_source IS 'Source system: unifi, ninjaone, tickets, booking, openphone, etc.';
COMMENT ON COLUMN action_events.phone_number IS 'Customer phone number for conversation correlation';
COMMENT ON COLUMN action_events.action_params IS 'JSON parameters specific to the action type';
COMMENT ON COLUMN action_events.action_result IS 'JSON result/outcome of the action';

-- DOWN (for rollback)
-- DROP TABLE IF EXISTS action_events;
