-- Performance indexes for ClubOS
CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON customer_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_route ON customer_interactions(route_selected);
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority ON tickets(status, priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_is_useful ON feedback(is_useful);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Analyze tables for query optimization
ANALYZE customer_interactions;
ANALYZE tickets;
ANALYZE feedback;
ANALYZE users;
