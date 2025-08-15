-- Create door access log table for UniFi door unlocks
CREATE TABLE IF NOT EXISTS door_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location VARCHAR(100) NOT NULL,
  door_name VARCHAR(255) NOT NULL,
  door_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id),
  username VARCHAR(255) NOT NULL,
  duration INTEGER,
  success BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_door_access_location ON door_access_log(location);
CREATE INDEX IF NOT EXISTS idx_door_access_user ON door_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_door_access_created ON door_access_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_door_access_door ON door_access_log(door_id);