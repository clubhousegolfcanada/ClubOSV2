-- TrackMan TPS 10 Remote Restart System
-- Allows dashboard-triggered and scheduled restarts of TrackMan across all locations

-- Device registry with per-device API keys
CREATE TABLE IF NOT EXISTS trackman_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  location VARCHAR(50) NOT NULL,
  bay_number INTEGER,
  api_key VARCHAR(64) UNIQUE NOT NULL,
  last_seen_at TIMESTAMP,
  last_restart_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'unknown',
  tps_version VARCHAR(50),
  exe_path TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Command queue with expiry
CREATE TABLE IF NOT EXISTS trackman_restart_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES trackman_devices(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  source VARCHAR(20) NOT NULL,
  requested_by UUID,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TIMESTAMP,
  completed_at TIMESTAMP,
  result_message TEXT,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes')
);

-- Indexes for polling performance
CREATE INDEX IF NOT EXISTS idx_trackman_commands_poll
  ON trackman_restart_commands(device_id, status, expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_trackman_devices_location
  ON trackman_devices(location);

CREATE INDEX IF NOT EXISTS idx_trackman_devices_api_key
  ON trackman_devices(api_key);

-- Seed auto-restart setting
INSERT INTO system_settings (key, value, description, updated_at)
VALUES (
  'trackman_auto_restart',
  '{"enabled": true, "cron": "0 3 * * *", "notify_slack": true}',
  'Automatic TrackMan TPS restart schedule',
  CURRENT_TIMESTAMP
)
ON CONFLICT (key) DO NOTHING;
