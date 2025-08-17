-- Create door_access_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS door_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location VARCHAR(100),
  door_name VARCHAR(255),
  door_id VARCHAR(255),
  action VARCHAR(50),
  user_id VARCHAR(255),
  username VARCHAR(255),
  duration INTEGER,
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_door_access_log_created_at ON door_access_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_door_access_log_location ON door_access_log(location);
CREATE INDEX IF NOT EXISTS idx_door_access_log_user_id ON door_access_log(user_id);