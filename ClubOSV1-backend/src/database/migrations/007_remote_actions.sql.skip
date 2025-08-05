-- Remote Actions Logging Migration
-- Run this after deploying the NinjaOne integration

-- Note: This migration might conflict with baseline schema
-- Using CREATE TABLE IF NOT EXISTS to handle existing tables

-- Create remote actions log table
CREATE TABLE IF NOT EXISTS remote_actions_log (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(50) NOT NULL,
  location VARCHAR(100) NOT NULL,
  device_name VARCHAR(200) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  initiated_by VARCHAR(255) NOT NULL,
  ninja_job_id VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'initiated',
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN completed_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (completed_at - created_at))::INTEGER
      ELSE NULL 
    END
  ) STORED
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_remote_actions_created ON remote_actions_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_remote_actions_user ON remote_actions_log(initiated_by);
CREATE INDEX IF NOT EXISTS idx_remote_actions_location ON remote_actions_log(location);
CREATE INDEX IF NOT EXISTS idx_remote_actions_job ON remote_actions_log(ninja_job_id);
CREATE INDEX IF NOT EXISTS idx_remote_actions_status ON remote_actions_log(status);
CREATE INDEX IF NOT EXISTS idx_remote_actions_device ON remote_actions_log(device_id);

-- Note: Removed system_events table reference as it doesn't exist in baseline schema

-- Create view for quick stats
CREATE OR REPLACE VIEW remote_actions_stats AS
SELECT 
  COUNT(*) as total_actions,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_actions,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_actions,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour,
  ROUND(
    COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as success_rate,
  MODE() WITHIN GROUP (ORDER BY action_type) as most_common_action,
  MODE() WITHIN GROUP (ORDER BY location) as most_active_location
FROM remote_actions_log
WHERE created_at > NOW() - INTERVAL '30 days';

-- Create function to get device status summary
CREATE OR REPLACE FUNCTION get_device_status_summary()
RETURNS TABLE(
  location VARCHAR,
  device_type VARCHAR,
  last_action TIMESTAMP,
  last_status VARCHAR,
  action_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ral.location,
    CASE 
      WHEN ral.device_name LIKE '%Bay%' THEN 'Simulator'
      WHEN ral.device_name LIKE '%Music%' THEN 'Music System'
      WHEN ral.device_name LIKE '%TV%' THEN 'TV System'
      ELSE 'Other'
    END as device_type,
    MAX(ral.created_at) as last_action,
    (SELECT status FROM remote_actions_log 
     WHERE device_id = ral.device_id 
     ORDER BY created_at DESC LIMIT 1) as last_status,
    COUNT(*) as action_count
  FROM remote_actions_log ral
  GROUP BY ral.location, ral.device_id, ral.device_name
  ORDER BY ral.location, device_type;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON TABLE remote_actions_log IS 'Tracks all remote actions executed through NinjaOne integration';
