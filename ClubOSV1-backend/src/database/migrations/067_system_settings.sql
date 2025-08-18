-- Migration: 067_system_settings.sql
-- Description: Add system settings table for global configuration
-- Created: 2025-08-18
-- Author: ClubOS Development Team

-- ============================================
-- UP MIGRATION
-- ============================================

-- Create system settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  category VARCHAR(50),
  updated_by UUID REFERENCES "Users"(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for quick lookups
CREATE INDEX idx_system_settings_key ON system_settings(key);
CREATE INDEX idx_system_settings_category ON system_settings(category);

-- Insert default settings
INSERT INTO system_settings (key, value, description, category) VALUES
  ('customer_auto_approval', '{"enabled": true}', 'Automatically approve customer accounts on signup', 'users'),
  ('operator_auto_approval', '{"enabled": false}', 'Automatically approve operator accounts on signup', 'users'),
  ('support_auto_approval', '{"enabled": false}', 'Automatically approve support accounts on signup', 'users')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- DOWN MIGRATION (for rollback)
-- ============================================

/*
DROP TABLE IF EXISTS system_settings CASCADE;
*/