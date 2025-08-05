-- =====================================================
-- BASELINE SCHEMA - Consolidation of all migrations
-- Created: 2025-08-03
-- This file consolidates 29 migration files into one baseline
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PHASE 1: Core Tables (no dependencies)
-- =====================================================

-- Users table (from database-tables.ts)
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
  CONSTRAINT valid_role CHECK (role IN ('admin', 'operator', 'support', 'kiosk'))
);

-- System configuration table
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Public requests table (from 015)
CREATE TABLE IF NOT EXISTS public_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL,
  source_id VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
-- PHASE 2: Feature Tables (depend on users)
-- =====================================================

-- Tickets table (consolidated from 002, 021, 026, 027)
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('facilities', 'tech')),
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
  priority VARCHAR(50) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  location VARCHAR(255),
  created_by_id UUID NOT NULL REFERENCES users(id),
  created_by_name VARCHAR(255) NOT NULL,
  created_by_email VARCHAR(255) NOT NULL,
  created_by_phone VARCHAR(50),
  assigned_to_id UUID REFERENCES users(id),
  assigned_to_name VARCHAR(255),
  assigned_to_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Ticket comments table (from 002)
CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  user_name VARCHAR(255) NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feedback table (consolidated from 001, 002, 003)
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id UUID REFERENCES users(id),
  user_email VARCHAR(255),
  request_description TEXT NOT NULL,
  location VARCHAR(255),
  route VARCHAR(50),
  response TEXT,
  confidence DECIMAL(3,2),
  is_useful BOOLEAN NOT NULL DEFAULT false,
  feedback_type VARCHAR(50),
  feedback_source VARCHAR(50) DEFAULT 'user',
  slack_thread_ts VARCHAR(255),
  slack_user_name VARCHAR(255),
  slack_user_id VARCHAR(255),
  slack_channel VARCHAR(255),
  original_request_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookings table (from database-tables.ts)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  simulator_id VARCHAR(255) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  duration INTEGER NOT NULL CHECK (duration >= 30 AND duration <= 240),
  type VARCHAR(50) NOT NULL CHECK (type IN ('single', 'recurring')),
  recurring_days INTEGER[],
  status VARCHAR(50) NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Checklist submissions (consolidated from 005, 008)
CREATE TABLE IF NOT EXISTS checklist_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL CHECK (category IN ('cleaning', 'tech')),
  type VARCHAR(50) NOT NULL CHECK (type IN ('daily', 'weekly', 'quarterly')),
  location VARCHAR(100) NOT NULL,
  completed_tasks JSONB NOT NULL DEFAULT '[]',
  total_tasks INTEGER NOT NULL,
  completion_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  comments TEXT,
  ticket_created BOOLEAN DEFAULT FALSE,
  ticket_id UUID REFERENCES tickets(id)
);

-- Checklist task customizations (from 016)
CREATE TABLE IF NOT EXISTS checklist_task_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL CHECK (category IN ('cleaning', 'tech')),
  task_key VARCHAR(255) NOT NULL,
  customization JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category, task_key)
);

-- Remote actions log (from 007)
CREATE TABLE IF NOT EXISTS remote_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,
  device_name VARCHAR(255) NOT NULL,
  device_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  executed_at TIMESTAMP,
  result TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Push notifications tables (from 019)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  failed_attempts INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL, -- 'message', 'ticket', 'system'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'clicked'
  error TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  clicked_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  messages_enabled BOOLEAN DEFAULT true,
  tickets_enabled BOOLEAN DEFAULT true,
  system_enabled BOOLEAN DEFAULT true,
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- PHASE 3: Integration Tables
-- =====================================================

-- OpenPhone conversations (consolidated from 011, 012, 017, 018, 020, 023, 024, 025)
CREATE TABLE IF NOT EXISTS openphone_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(255) UNIQUE,
  phone_number VARCHAR(20),
  customer_name VARCHAR(255),
  employee_name VARCHAR(255),
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  last_message_at TIMESTAMP,
  unread_count INTEGER DEFAULT 0,
  assigned_to UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'active',
  tags TEXT[]
);

-- Message status table (from 017)
CREATE TABLE IF NOT EXISTS message_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  last_read_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Slack messages table (from 001)
CREATE TABLE IF NOT EXISTS slack_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_ts VARCHAR(255) UNIQUE NOT NULL,
  user_name VARCHAR(255),
  user_id VARCHAR(255),
  channel VARCHAR(255),
  message_text TEXT,
  bot_response TEXT,
  response_confidence DECIMAL(3,2),
  response_route VARCHAR(50),
  slack_replied BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Slack replies table (from 004)
CREATE TABLE IF NOT EXISTS slack_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_ts VARCHAR(255) NOT NULL,
  message_ts VARCHAR(255) UNIQUE NOT NULL,
  user_name VARCHAR(255),
  user_id VARCHAR(255),
  channel VARCHAR(255),
  reply_text TEXT NOT NULL,
  reply_type VARCHAR(50) DEFAULT 'human',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Slack thread resolutions (from 010)
CREATE TABLE IF NOT EXISTS slack_thread_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_ts VARCHAR(255) NOT NULL,
  resolved_by VARCHAR(255),
  resolution_text TEXT NOT NULL,
  knowledge_captured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- HubSpot cache table (from 028)
CREATE TABLE IF NOT EXISTS hubspot_cache (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  owner_id VARCHAR(255),
  owner_name VARCHAR(255),
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PHASE 4: AI/Knowledge Tables
-- =====================================================

-- Assistant knowledge table (from 014)
CREATE TABLE IF NOT EXISTS assistant_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

-- Knowledge captures (from 010)
CREATE TABLE IF NOT EXISTS knowledge_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(50) NOT NULL,
  source_id VARCHAR(255),
  captured_by UUID REFERENCES users(id),
  problem TEXT NOT NULL,
  solution TEXT NOT NULL,
  category VARCHAR(50),
  tags TEXT[],
  confidence FLOAT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge audit log (from 013)
CREATE TABLE IF NOT EXISTS knowledge_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL,
  knowledge_id UUID,
  knowledge_type VARCHAR(50),
  old_value JSONB,
  new_value JSONB,
  performed_by UUID REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- AI prompt templates (from 021)
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  template TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  category VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_prompt_template_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES ai_prompt_templates(id) ON DELETE CASCADE,
  template_snapshot JSONB NOT NULL,
  changed_by UUID REFERENCES users(id),
  change_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Parent documents (from add-document-relationships)
CREATE TABLE IF NOT EXISTS parent_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- PHASE 5: Legacy/Archive Tables (SOP system - being phased out)
-- =====================================================

-- Extracted knowledge (from 011)
CREATE TABLE IF NOT EXISTS extracted_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID,
  source_type VARCHAR(20),
  category VARCHAR(50),
  problem TEXT NOT NULL,
  solution TEXT NOT NULL,
  confidence FLOAT,
  applied_to_sop BOOLEAN DEFAULT FALSE,
  sop_file VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- SOP shadow comparisons (from 011)
CREATE TABLE IF NOT EXISTS sop_shadow_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  route VARCHAR(50) NOT NULL,
  assistant_response TEXT,
  sop_response TEXT,
  sop_confidence FLOAT,
  assistant_time_ms INTEGER,
  sop_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- SOP embeddings (from index.ts)
CREATE TABLE IF NOT EXISTS sop_embeddings (
  id VARCHAR(255) PRIMARY KEY,
  assistant VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  embedding TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- SOP metrics (from 011/index.ts)
CREATE TABLE IF NOT EXISTS sop_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  total_requests INTEGER DEFAULT 0,
  sop_used INTEGER DEFAULT 0,
  assistant_used INTEGER DEFAULT 0,
  sop_avg_confidence FLOAT,
  sop_avg_response_time_ms FLOAT,
  assistant_avg_response_time_ms FLOAT
);

-- SOP update queue (from 010)
CREATE TABLE IF NOT EXISTS sop_update_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant VARCHAR(50) NOT NULL,
  knowledge_capture_id UUID REFERENCES knowledge_captures(id),
  priority INTEGER DEFAULT 5,
  status VARCHAR(50) DEFAULT 'pending',
  processed_at TIMESTAMP,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- SOP drafts (from 010)
CREATE TABLE IF NOT EXISTS sop_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant VARCHAR(50) NOT NULL,
  section VARCHAR(255) NOT NULL,
  original_content TEXT,
  suggested_content TEXT NOT NULL,
  change_type VARCHAR(50),
  confidence FLOAT,
  approved BOOLEAN,
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- SOP update log (from 010)
CREATE TABLE IF NOT EXISTS sop_update_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant VARCHAR(50) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  change_summary TEXT NOT NULL,
  updated_by VARCHAR(50) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Learning metrics (from 010)
CREATE TABLE IF NOT EXISTS learning_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  knowledge_captured INTEGER DEFAULT 0,
  sop_updates_suggested INTEGER DEFAULT 0,
  sop_updates_approved INTEGER DEFAULT 0,
  avg_confidence FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Vector store archive (from 013)
CREATE TABLE IF NOT EXISTS vector_store_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vector_store_id VARCHAR(255) NOT NULL,
  assistant_id VARCHAR(255) NOT NULL,
  file_id VARCHAR(255),
  file_name VARCHAR(255),
  content TEXT,
  metadata JSONB DEFAULT '{}',
  archived_at TIMESTAMP DEFAULT NOW(),
  archived_by UUID REFERENCES users(id)
);

-- Vector store deletion log (from 013)
CREATE TABLE IF NOT EXISTS vector_store_deletion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vector_store_id VARCHAR(255) NOT NULL,
  assistant_id VARCHAR(255) NOT NULL,
  deletion_reason VARCHAR(255) DEFAULT 'SOP system disabled',
  deleted_at TIMESTAMP DEFAULT NOW(),
  deleted_by UUID REFERENCES users(id)
);

-- =====================================================
-- PHASE 6: Logging Tables
-- =====================================================

-- Access logs (from database-tables.ts)
CREATE TABLE IF NOT EXISTS access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  user_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auth logs (from database-tables.ts)
CREATE TABLE IF NOT EXISTS auth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Request logs (from database-tables.ts)
CREATE TABLE IF NOT EXISTS request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method VARCHAR(10) NOT NULL,
  path VARCHAR(500) NOT NULL,
  status_code INTEGER,
  response_time INTEGER,
  user_id UUID REFERENCES users(id),
  ip_address VARCHAR(45),
  user_agent TEXT,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer interactions (from database-tables.ts)
CREATE TABLE IF NOT EXISTS customer_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  user_email VARCHAR(255),
  request_text TEXT NOT NULL,
  response_text TEXT,
  route VARCHAR(50),
  confidence DECIMAL(3,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Routing optimizations (from database-tables.ts)
CREATE TABLE IF NOT EXISTS routing_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  optimization_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  applied_at TIMESTAMP,
  applied_by UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT
);

-- =====================================================
-- INDEXES - Organized by table
-- =====================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Tickets indexes
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by_id ON tickets(created_by_id);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
-- Create index on tickets timestamp column (try both naming conventions)
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
-- This will fail silently if created_at doesn't exist

-- Ticket comments indexes
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'ticket_comments' AND column_name = 'ticket_id') THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'ticket_comments' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_comments_user_id ON ticket_comments(user_id);
  END IF;
END $$;

-- Feedback indexes
CREATE INDEX IF NOT EXISTS idx_feedback_is_useful ON feedback(is_useful);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);

-- Bookings indexes
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_simulator_id ON bookings(simulator_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Checklist submissions indexes
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_user_id ON checklist_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_category ON checklist_submissions(category);
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_type ON checklist_submissions(type);
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_location ON checklist_submissions(location);
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_completion_time ON checklist_submissions(completion_time DESC);

-- OpenPhone conversations indexes
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_processed ON openphone_conversations(processed);
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_phone_number ON openphone_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_updated_at ON openphone_conversations(updated_at DESC);

-- Message status indexes
CREATE INDEX IF NOT EXISTS idx_message_status_conversation_id ON message_status(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_status_user_id ON message_status(user_id);

-- Slack messages indexes
CREATE INDEX IF NOT EXISTS idx_slack_messages_thread_ts ON slack_messages(thread_ts);
CREATE INDEX IF NOT EXISTS idx_slack_messages_channel ON slack_messages(channel);

-- Knowledge indexes
CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_assistant_id ON assistant_knowledge(assistant_id);
CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_category ON assistant_knowledge(category);
CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_category ON extracted_knowledge(category);
CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_applied ON extracted_knowledge(applied_to_sop);

-- SOP indexes
CREATE INDEX IF NOT EXISTS idx_sop_embeddings_assistant ON sop_embeddings(assistant);

-- Push notification indexes
CREATE INDEX IF NOT EXISTS idx_push_subs_user_active ON push_subscriptions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_notification_history_user_date ON notification_history(user_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status, sent_at);

-- Logging indexes
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_action ON auth_logs(action);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_path ON request_logs(path);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_user_id ON customer_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_created_at ON customer_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_routing_optimizations_created_at ON routing_optimizations(created_at);
CREATE INDEX IF NOT EXISTS idx_routing_optimizations_status ON routing_optimizations(status);

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert default system configuration
INSERT INTO system_config (key, value, description) VALUES
  ('maintenance_mode', '{"enabled": false}', 'System maintenance mode toggle'),
  ('rate_limits', '{"default": 100, "auth": 5, "llm": 30}', 'API rate limiting configuration'),
  ('feature_flags', '{"new_ui": true, "beta_features": false}', 'Feature toggle flags')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- MIGRATION METADATA
-- =====================================================

-- Create migration history table
CREATE TABLE IF NOT EXISTS migration_history (
  id SERIAL PRIMARY KEY,
  version VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64),
  execution_time_ms INTEGER,
  applied_by VARCHAR(255)
);

-- Record this baseline migration
INSERT INTO migration_history (version, name, checksum, applied_by) VALUES
  ('000', 'baseline_schema', 'consolidated_from_29_files', 'system')
ON CONFLICT (version) DO NOTHING;

-- =====================================================
-- COMMENTS for documentation
-- =====================================================

COMMENT ON TABLE users IS 'Core user accounts table';
COMMENT ON TABLE tickets IS 'Support ticket tracking system';
COMMENT ON TABLE openphone_conversations IS 'OpenPhone SMS conversations and messages';
COMMENT ON TABLE assistant_knowledge IS 'Knowledge base for AI assistants';
COMMENT ON TABLE sop_embeddings IS 'Legacy SOP system - being phased out';