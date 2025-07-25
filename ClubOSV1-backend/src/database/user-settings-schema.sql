-- User Settings table for storing user-specific preferences
CREATE TABLE user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  setting_key VARCHAR(255) NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, setting_key)
);

-- Index for faster lookups
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- Example data structure for external_links setting:
-- {
--   "REMOTE_DESKTOP": "https://custom-url.com",
--   "BOOKING_SITE": "https://another-url.com"
-- }
