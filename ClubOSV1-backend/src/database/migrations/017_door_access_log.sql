-- Create door_access_log table for tracking door access events
CREATE TABLE IF NOT EXISTS door_access_log (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(50) NOT NULL, -- unlock, lock, emergency_unlock_all, emergency_lockdown
  location VARCHAR(100) NOT NULL,
  door_id VARCHAR(100) NOT NULL,
  door_name VARCHAR(100) NOT NULL,
  initiated_by VARCHAR(255) NOT NULL, -- user email
  duration_seconds INTEGER, -- for unlock actions
  reason TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'completed', -- completed, failed
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_door_access_log_location ON door_access_log(location);
CREATE INDEX IF NOT EXISTS idx_door_access_log_created_at ON door_access_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_door_access_log_initiated_by ON door_access_log(initiated_by);
CREATE INDEX IF NOT EXISTS idx_door_access_log_door_name ON door_access_log(door_name);