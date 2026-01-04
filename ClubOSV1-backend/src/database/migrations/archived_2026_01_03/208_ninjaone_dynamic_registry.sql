-- Migration: Create NinjaOne dynamic script and device registry
-- This allows dynamic management of NinjaOne scripts and devices without code changes

-- Scripts table - stores available NinjaOne scripts
CREATE TABLE IF NOT EXISTS ninjaone_scripts (
  id SERIAL PRIMARY KEY,
  script_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  category VARCHAR(50), -- 'trackman', 'system', 'music', 'tv', 'other'
  icon VARCHAR(50) DEFAULT 'zap', -- lucide icon name
  requires_bay BOOLEAN DEFAULT true,
  warning_message TEXT,
  estimated_duration VARCHAR(50) DEFAULT '30-60 seconds',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Devices table - stores NinjaOne managed devices
CREATE TABLE IF NOT EXISTS ninjaone_devices (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  location VARCHAR(100) NOT NULL,
  bay_number VARCHAR(10), -- '1', '2', '3', 'music', 'tv'
  device_name VARCHAR(255) NOT NULL,
  device_type VARCHAR(50), -- 'trackman', 'music', 'tv', 'other'
  is_active BOOLEAN DEFAULT true,
  last_seen TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(location, bay_number)
);

-- Execution log - already exists as remote_actions_log but let's ensure it exists
CREATE TABLE IF NOT EXISTS remote_actions_log (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(50),
  location VARCHAR(100),
  device_name VARCHAR(100),
  device_id VARCHAR(100),
  initiated_by VARCHAR(255),
  ninja_job_id VARCHAR(100),
  status VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Insert some default script configurations (will be replaced when synced with NinjaOne)
INSERT INTO ninjaone_scripts (script_id, name, display_name, category, icon, requires_bay, warning_message, estimated_duration)
VALUES 
  ('restart-trackman', 'restart-trackman', 'Restart TrackMan', 'trackman', 'refresh-cw', true, NULL, '30-60 seconds'),
  ('reboot-pc', 'reboot-pc', 'Reboot PC', 'system', 'power', true, 'This will reboot the entire PC. The bay will be unavailable for 3-5 minutes.', '3-5 minutes'),
  ('restart-music', 'restart-music', 'Restart Music System', 'music', 'music', false, NULL, '30 seconds'),
  ('restart-tv', 'restart-tv', 'Restart TV System', 'tv', 'tv', false, NULL, '30 seconds')
ON CONFLICT (script_id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ninjaone_scripts_active ON ninjaone_scripts(is_active);
CREATE INDEX IF NOT EXISTS idx_ninjaone_devices_location ON ninjaone_devices(location);
CREATE INDEX IF NOT EXISTS idx_ninjaone_devices_active ON ninjaone_devices(is_active);
CREATE INDEX IF NOT EXISTS idx_remote_actions_log_created ON remote_actions_log(created_at DESC);