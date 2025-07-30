-- Performance indexes for ClubOS V1.8.5
-- Run this script to improve database query performance

-- Knowledge audit log indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_audit_target 
ON knowledge_audit_log(assistant_target);

CREATE INDEX IF NOT EXISTS idx_knowledge_audit_category 
ON knowledge_audit_log(category);

CREATE INDEX IF NOT EXISTS idx_knowledge_audit_timestamp 
ON knowledge_audit_log(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_audit_search
ON knowledge_audit_log(key, new_value);

-- Customer interactions indexes
CREATE INDEX IF NOT EXISTS idx_customer_interactions_description 
ON customer_interactions USING GIN(to_tsvector('english', description));

CREATE INDEX IF NOT EXISTS idx_customer_interactions_timestamp
ON customer_interactions(timestamp DESC);

-- Extracted knowledge indexes
CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_category
ON extracted_knowledge(category);

CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_search
ON extracted_knowledge(problem, solution);

-- Tickets indexes
CREATE INDEX IF NOT EXISTS idx_tickets_status
ON tickets(status);

CREATE INDEX IF NOT EXISTS idx_tickets_priority_status
ON tickets(priority, status);

-- Bookings indexes
CREATE INDEX IF NOT EXISTS idx_bookings_date
ON bookings(date);

CREATE INDEX IF NOT EXISTS idx_bookings_status
ON bookings(status);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_role
ON users(role);

-- Feedback indexes  
CREATE INDEX IF NOT EXISTS idx_feedback_created_at
ON feedback(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_rating
ON feedback(rating);

-- Analyze tables to update statistics
ANALYZE knowledge_audit_log;
ANALYZE customer_interactions;
ANALYZE extracted_knowledge;
ANALYZE tickets;
ANALYZE bookings;
ANALYZE users;
ANALYZE feedback;