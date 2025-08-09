-- Drop existing table if it exists (to handle partial state)
DROP TABLE IF EXISTS door_access_log CASCADE;

-- Door Access Log Table
CREATE TABLE door_access_log (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(50) NOT NULL, -- unlock, lock, emergency_unlock_all, lockdown
  location VARCHAR(100) NOT NULL,
  door_id VARCHAR(100) NOT NULL,
  door_name VARCHAR(100),
  initiated_by VARCHAR(255) NOT NULL,
  duration_seconds INTEGER,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'initiated', -- initiated, completed, failed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  metadata JSONB
);

-- Indexes for performance
CREATE INDEX idx_door_access_location ON door_access_log(location);
CREATE INDEX idx_door_access_created ON door_access_log(created_at DESC);
CREATE INDEX idx_door_access_user ON door_access_log(initiated_by);
CREATE INDEX idx_door_access_status ON door_access_log(status);

-- Add comment
COMMENT ON TABLE door_access_log IS 'Audit log for all door access operations via UniFi Access integration';