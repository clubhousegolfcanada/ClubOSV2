-- UP
-- Performance indexes for commonly queried fields
-- These will significantly improve query performance

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Tickets table indexes
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_location ON tickets(location);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by_id ON tickets(created_by_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_id ON tickets(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_tickets_status_category ON tickets(status, category);
CREATE INDEX IF NOT EXISTS idx_tickets_location_status ON tickets(location, status);

-- Messages/OpenPhone conversations indexes
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_phone ON openphone_conversations(customer_phone_number);
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_created ON openphone_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_customer_id ON openphone_conversations(customer_id);

-- Patterns table indexes (for V3-PLS)
CREATE INDEX IF NOT EXISTS idx_patterns_active ON patterns(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON patterns(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_created ON patterns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_auto_execute ON patterns(auto_execute) WHERE auto_execute = true;

-- Customer interactions indexes
CREATE INDEX IF NOT EXISTS idx_customer_interactions_user_id ON customer_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_created ON customer_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_session ON customer_interactions(session_id);

-- Checklist submissions indexes
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_location ON checklist_submissions(location);
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_created ON checklist_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_user ON checklist_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_completed ON checklist_submissions(completion_time DESC);

-- Knowledge base indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON knowledge_base USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_updated ON knowledge_base(updated_at DESC);

-- Feedback indexes
CREATE INDEX IF NOT EXISTS idx_feedback_useful ON feedback(is_useful);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);

-- Access logs indexes (for audit and monitoring)
CREATE INDEX IF NOT EXISTS idx_access_logs_user ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON access_logs(action);
CREATE INDEX IF NOT EXISTS idx_access_logs_created ON access_logs("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_success ON access_logs(success);

-- Request logs indexes (for performance monitoring)
CREATE INDEX IF NOT EXISTS idx_request_logs_path ON request_logs(path);
CREATE INDEX IF NOT EXISTS idx_request_logs_status ON request_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_request_logs_created ON request_logs("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_response_time ON request_logs(response_time DESC);

-- AI automations indexes
CREATE INDEX IF NOT EXISTS idx_ai_automations_enabled ON ai_automations(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_ai_automations_feature ON ai_automations(feature);

-- Challenge system indexes (if using challenges)
CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged ON challenges(challenged_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_created ON challenges(created_at DESC);

-- ClubCoin transactions indexes
CREATE INDEX IF NOT EXISTS idx_club_coin_transactions_user ON club_coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_club_coin_transactions_created ON club_coin_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_coin_transactions_type ON club_coin_transactions(transaction_type);

-- Analyze tables to update statistics for query planner
ANALYZE users;
ANALYZE tickets;
ANALYZE openphone_conversations;
ANALYZE patterns;
ANALYZE customer_interactions;
ANALYZE checklist_submissions;
ANALYZE knowledge_base;
ANALYZE feedback;
ANALYZE access_logs;
ANALYZE request_logs;

-- DOWN
-- Drop all performance indexes
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_created_at;
DROP INDEX IF EXISTS idx_tickets_status;
DROP INDEX IF EXISTS idx_tickets_category;
DROP INDEX IF EXISTS idx_tickets_location;
DROP INDEX IF EXISTS idx_tickets_created_by_id;
DROP INDEX IF EXISTS idx_tickets_assigned_to_id;
DROP INDEX IF EXISTS idx_tickets_created_at;
DROP INDEX IF EXISTS idx_tickets_priority;
DROP INDEX IF EXISTS idx_tickets_status_category;
DROP INDEX IF EXISTS idx_tickets_location_status;
DROP INDEX IF EXISTS idx_openphone_conversations_phone;
DROP INDEX IF EXISTS idx_openphone_conversations_created;
DROP INDEX IF EXISTS idx_openphone_conversations_customer_id;
DROP INDEX IF EXISTS idx_patterns_active;
DROP INDEX IF EXISTS idx_patterns_confidence;
DROP INDEX IF EXISTS idx_patterns_created;
DROP INDEX IF EXISTS idx_patterns_auto_execute;
DROP INDEX IF EXISTS idx_customer_interactions_user_id;
DROP INDEX IF EXISTS idx_customer_interactions_created;
DROP INDEX IF EXISTS idx_customer_interactions_session;
DROP INDEX IF EXISTS idx_checklist_submissions_location;
DROP INDEX IF EXISTS idx_checklist_submissions_created;
DROP INDEX IF EXISTS idx_checklist_submissions_user;
DROP INDEX IF EXISTS idx_checklist_submissions_completed;
DROP INDEX IF EXISTS idx_knowledge_base_category;
DROP INDEX IF EXISTS idx_knowledge_base_tags;
DROP INDEX IF EXISTS idx_knowledge_base_updated;
DROP INDEX IF EXISTS idx_feedback_useful;
DROP INDEX IF EXISTS idx_feedback_created;
DROP INDEX IF EXISTS idx_feedback_user;
DROP INDEX IF EXISTS idx_access_logs_user;
DROP INDEX IF EXISTS idx_access_logs_action;
DROP INDEX IF EXISTS idx_access_logs_created;
DROP INDEX IF EXISTS idx_access_logs_success;
DROP INDEX IF EXISTS idx_request_logs_path;
DROP INDEX IF EXISTS idx_request_logs_status;
DROP INDEX IF EXISTS idx_request_logs_created;
DROP INDEX IF EXISTS idx_request_logs_response_time;
DROP INDEX IF EXISTS idx_ai_automations_enabled;
DROP INDEX IF EXISTS idx_ai_automations_feature;
DROP INDEX IF EXISTS idx_challenges_challenger;
DROP INDEX IF EXISTS idx_challenges_challenged;
DROP INDEX IF EXISTS idx_challenges_status;
DROP INDEX IF EXISTS idx_challenges_created;
DROP INDEX IF EXISTS idx_club_coin_transactions_user;
DROP INDEX IF EXISTS idx_club_coin_transactions_created;
DROP INDEX IF EXISTS idx_club_coin_transactions_type;