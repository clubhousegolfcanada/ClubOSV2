-- =====================================================
-- CONSOLIDATED BASELINE SCHEMA V2 (FIXED)
-- Date: 2025-08-17
-- Purpose: Clean consolidated schema with proper PostgreSQL syntax
-- =====================================================

-- Drop existing schema (only in development!)
-- Uncomment these lines for clean slate in dev:
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- MIGRATION TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64),
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  rollback_sql TEXT
);

-- Insert this baseline as first migration
INSERT INTO schema_migrations (version, name, checksum) 
VALUES ('001', 'consolidated_baseline_v2', MD5('consolidated_baseline_v2'))
ON CONFLICT (version) DO NOTHING;

-- =====================================================
-- CORE TABLES (No Dependencies)
-- =====================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'support',
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  CONSTRAINT valid_role CHECK (role IN ('admin', 'operator', 'support', 'kiosk'))
);

-- System configuration
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  category VARCHAR(50),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id)
);

-- =====================================================
-- MESSAGING & COMMUNICATIONS
-- =====================================================

-- OpenPhone conversations (consolidated)
CREATE TABLE IF NOT EXISTS openphone_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255),
  messages JSONB DEFAULT '[]',
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  conversation_id VARCHAR(255),
  message_count INTEGER DEFAULT 0,
  last_message_direction VARCHAR(20),
  last_message_text TEXT,
  processed_at TIMESTAMP,
  assistant_type VARCHAR(50),
  assistant_confidence FLOAT,
  assistant_response TEXT
);

-- =====================================================
-- TICKETING SYSTEM
-- =====================================================

-- Tickets table (consolidated)
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  priority VARCHAR(50) NOT NULL DEFAULT 'medium',
  location VARCHAR(255),
  created_by UUID REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  CONSTRAINT valid_category CHECK (category IN ('facilities', 'tech', 'general')),
  CONSTRAINT valid_status CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

-- Ticket comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- AI & AUTOMATION
-- =====================================================

-- AI automation features
CREATE TABLE IF NOT EXISTS ai_automation_features (
  feature_key VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  is_active BOOLEAN DEFAULT false,
  require_confirmation BOOLEAN DEFAULT false,
  confidence_threshold FLOAT DEFAULT 0.7,
  max_responses_per_conversation INTEGER DEFAULT 3,
  use_assistant_knowledge BOOLEAN DEFAULT true,
  hardcoded_response TEXT,
  configuration JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI automation usage tracking
CREATE TABLE IF NOT EXISTS ai_automation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key VARCHAR(50) REFERENCES ai_automation_features(feature_key),
  conversation_id UUID REFERENCES openphone_conversations(id),
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confidence_score FLOAT,
  action_taken VARCHAR(50),
  success BOOLEAN,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

-- AI automation response tracking
CREATE TABLE IF NOT EXISTS ai_automation_response_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES openphone_conversations(id),
  feature_key VARCHAR(50) REFERENCES ai_automation_features(feature_key),
  response_count INTEGER DEFAULT 1,
  last_response_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(conversation_id, feature_key)
);

-- AI automation actions
CREATE TABLE IF NOT EXISTS ai_automation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key VARCHAR(50) REFERENCES ai_automation_features(feature_key),
  conversation_id UUID REFERENCES openphone_conversations(id),
  action_type VARCHAR(50) NOT NULL,
  action_data JSONB DEFAULT '{}',
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  response_text TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Assistant knowledge
CREATE TABLE IF NOT EXISTS assistant_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_name VARCHAR(100) NOT NULL,
  knowledge_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

-- Extracted knowledge
CREATE TABLE IF NOT EXISTS extracted_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES openphone_conversations(id),
  knowledge_type VARCHAR(50),
  question TEXT,
  answer TEXT,
  confidence_score FLOAT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge store (new unified system)
CREATE TABLE IF NOT EXISTS knowledge_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  source VARCHAR(50),
  confidence_score FLOAT DEFAULT 1.0,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

-- Prompt templates
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  template TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  category VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

-- =====================================================
-- FEEDBACK & ANALYTICS
-- =====================================================

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  request_text TEXT NOT NULL,
  response_text TEXT,
  route VARCHAR(50),
  confidence FLOAT,
  is_helpful BOOLEAN,
  feedback_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage logs
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10),
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- OPERATIONS
-- =====================================================

-- Checklist submissions
CREATE TABLE IF NOT EXISTS checklist_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  checklist_type VARCHAR(50) NOT NULL,
  completed_tasks JSONB DEFAULT '[]',
  incomplete_tasks JSONB DEFAULT '[]',
  custom_tasks JSONB DEFAULT '[]',
  comments TEXT,
  ticket_created BOOLEAN DEFAULT false,
  ticket_id UUID REFERENCES tickets(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Checklist task customizations
CREATE TABLE IF NOT EXISTS checklist_task_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_type VARCHAR(50) NOT NULL,
  task_id VARCHAR(100) NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  custom_text TEXT,
  display_order INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(checklist_type, task_id)
);

-- Remote action history
CREATE TABLE IF NOT EXISTS remote_action_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(50) NOT NULL,
  location VARCHAR(100),
  device_id VARCHAR(255),
  user_id UUID REFERENCES users(id),
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Door access log
CREATE TABLE IF NOT EXISTS door_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location VARCHAR(100) NOT NULL,
  door_name VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id),
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INTEGRATIONS
-- =====================================================

-- Slack replies tracking
CREATE TABLE IF NOT EXISTS slack_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_ts VARCHAR(255) NOT NULL UNIQUE,
  channel VARCHAR(255),
  original_message TEXT,
  replies JSONB DEFAULT '[]',
  last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- HubSpot contact cache
CREATE TABLE IF NOT EXISTS hubspot_contact_cache (
  phone_number VARCHAR(50) PRIMARY KEY,
  contact_id VARCHAR(255),
  full_name VARCHAR(255),
  email VARCHAR(255),
  company VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_synced_at TIMESTAMP
);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

-- Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL,
  device_info JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification history
CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  body TEXT,
  data JSONB DEFAULT '{}',
  delivered BOOLEAN DEFAULT false,
  read BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP
);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  push_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  notification_types JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PUBLIC ACCESS
-- =====================================================

-- Public requests
CREATE TABLE IF NOT EXISTS public_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL,
  source_id VARCHAR(255),
  customer_info JSONB DEFAULT '{}',
  request_text TEXT NOT NULL,
  response_text TEXT,
  route VARCHAR(50),
  confidence FLOAT,
  assistant_used VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CREATE ALL INDEXES
-- =====================================================

-- OpenPhone conversations indexes
CREATE INDEX IF NOT EXISTS idx_openphone_phone_number ON openphone_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_openphone_updated_at ON openphone_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_openphone_is_read ON openphone_conversations(is_read);
CREATE INDEX IF NOT EXISTS idx_openphone_conversation_id ON openphone_conversations(conversation_id);

-- Tickets indexes
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority ON tickets(status, priority);

-- Ticket comments indexes
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON ticket_comments(created_at);

-- Assistant knowledge indexes
CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_name ON assistant_knowledge(assistant_name);

-- Extracted knowledge indexes
CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_conversation ON extracted_knowledge(conversation_id);
CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_type ON extracted_knowledge(knowledge_type);

-- Knowledge store indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_store_category ON knowledge_store(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_store_tags ON knowledge_store USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_store_is_active ON knowledge_store(is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_store_usage ON knowledge_store(usage_count DESC);

-- Usage logs indexes
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_endpoint ON usage_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_endpoint ON usage_logs(user_id, endpoint, created_at DESC);

-- Checklist submissions indexes
CREATE INDEX IF NOT EXISTS idx_checklist_user_id ON checklist_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_type ON checklist_submissions(checklist_type);
CREATE INDEX IF NOT EXISTS idx_checklist_created_at ON checklist_submissions(created_at DESC);

-- Door access log indexes
CREATE INDEX IF NOT EXISTS idx_door_access_location ON door_access_log(location);
CREATE INDEX IF NOT EXISTS idx_door_access_created_at ON door_access_log(created_at DESC);

-- Push subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_is_active ON push_subscriptions(is_active);

-- Notification history indexes
CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_created_at ON notification_history(created_at DESC);

-- Public requests indexes
CREATE INDEX IF NOT EXISTS idx_public_requests_source ON public_requests(source);
CREATE INDEX IF NOT EXISTS idx_public_requests_created_at ON public_requests(created_at DESC);

-- AI automation indexes
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature_date ON ai_automation_usage(feature_key, triggered_at DESC);

-- Additional composite index for OpenPhone
CREATE INDEX IF NOT EXISTS idx_openphone_phone_updated ON openphone_conversations(phone_number, updated_at DESC);

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- System configuration defaults
INSERT INTO system_config (key, value, description, category) VALUES
  ('slack_notifications', '{"enabled": true, "webhook_url": null}', 'Slack notification settings', 'integrations'),
  ('openphone_config', '{"enabled": true, "rate_limit": 30}', 'OpenPhone integration settings', 'integrations'),
  ('ai_config', '{"enabled": true, "model": "gpt-4", "temperature": 0.7}', 'AI configuration', 'ai'),
  ('system_features', '{"tickets": true, "checklists": true, "knowledge": true}', 'System feature flags', 'features')
ON CONFLICT (key) DO NOTHING;

-- Default AI automation features
INSERT INTO ai_automation_features (feature_key, name, description, category, is_active) VALUES
  ('gift_cards', 'Gift Card Inquiries', 'Automatically respond to gift card questions', 'sales', true),
  ('trackman_reset', 'Trackman Reset', 'Reset frozen Trackman units', 'technical', false),
  ('booking_changes', 'Booking Modifications', 'Handle booking change requests', 'booking', false),
  ('hours_info', 'Hours Information', 'Provide business hours', 'info', true)
ON CONFLICT (feature_key) DO NOTHING;

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to relevant tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT unnest(ARRAY[
      'users', 'tickets', 'ticket_comments', 'openphone_conversations',
      'ai_automation_features', 'assistant_knowledge', 'knowledge_store',
      'ai_prompt_templates', 'checklist_task_customizations', 'slack_replies',
      'hubspot_contact_cache', 'push_subscriptions', 'notification_preferences'
    ])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
      CREATE TRIGGER update_%I_updated_at 
      BEFORE UPDATE ON %I 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column()', t, t, t, t);
  END LOOP;
END $$;

-- =====================================================
-- PERMISSIONS (for production)
-- =====================================================

-- Grant appropriate permissions to application user
-- Uncomment and adjust for production:
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO clubos_app;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO clubos_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO clubos_app;

-- =====================================================
-- VALIDATION QUERIES
-- =====================================================

-- These queries should all return results after migration:
-- SELECT COUNT(*) FROM schema_migrations;
-- SELECT COUNT(*) FROM system_config;
-- SELECT COUNT(*) FROM ai_automation_features;
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- =====================================================
-- ROLLBACK SCRIPT (save separately)
-- =====================================================
-- To rollback this migration, run:
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;
-- Then restore from backup