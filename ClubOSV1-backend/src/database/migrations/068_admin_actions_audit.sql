-- Migration: Add admin_actions table for audit logging
-- Purpose: Track all administrative actions including CC adjustments

-- Create admin_actions table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON admin_actions (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target_user ON admin_actions (target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON admin_actions (action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions (created_at DESC);

-- Add comment
COMMENT ON TABLE admin_actions IS 'Audit log for all administrative actions';
COMMENT ON COLUMN admin_actions.action_type IS 'Type of action: cc_adjustment, user_approval, user_rejection, user_deletion, etc.';
COMMENT ON COLUMN admin_actions.details IS 'JSON details of the action performed';

-- Create a view for CC adjustment history
CREATE OR REPLACE VIEW cc_adjustment_history AS
SELECT 
  aa.id,
  aa.created_at as adjusted_at,
  u_admin.name as admin_name,
  u_admin.email as admin_email,
  u_target.name as customer_name,
  u_target.email as customer_email,
  aa.details->>'type' as adjustment_type,
  (aa.details->>'amount')::DECIMAL as amount,
  (aa.details->>'balance_before')::DECIMAL as balance_before,
  (aa.details->>'balance_after')::DECIMAL as balance_after,
  aa.details->>'reason' as reason
FROM admin_actions aa
JOIN users u_admin ON aa.admin_id = u_admin.id
LEFT JOIN users u_target ON aa.target_user_id = u_target.id
WHERE aa.action_type = 'cc_adjustment'
ORDER BY aa.created_at DESC;