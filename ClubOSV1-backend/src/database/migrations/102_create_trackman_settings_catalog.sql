-- UP
-- Create trackman_settings_catalog table if it doesn't exist
CREATE TABLE IF NOT EXISTS trackman_settings_catalog (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50) DEFAULT 'standard',
  course_name VARCHAR(200),
  holes INTEGER DEFAULT 18,
  scoring_type VARCHAR(50) DEFAULT 'stroke_play',
  tee_type VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_trackman_settings_active ON trackman_settings_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_trackman_settings_category ON trackman_settings_catalog(category);

-- DOWN
DROP TABLE IF EXISTS trackman_settings_catalog;