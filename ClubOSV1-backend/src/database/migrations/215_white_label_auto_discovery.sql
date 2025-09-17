-- Migration: Enhanced white label feature tracking for auto-discovery
-- Description: Adds dependency tracking, code locations, and config keys for white label features

-- UP
-- Add columns to feature_inventory for enhanced tracking
ALTER TABLE feature_inventory
ADD COLUMN IF NOT EXISTS dependencies JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS code_locations JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS config_keys JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS file_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS line_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_scanned TIMESTAMP;

-- Add columns to branding_inventory for location tracking
ALTER TABLE branding_inventory
ADD COLUMN IF NOT EXISTS code_locations JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS file_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_scanned TIMESTAMP;

-- Create table for auto-discovered golf-specific terms
CREATE TABLE IF NOT EXISTS golf_specific_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term VARCHAR(255) NOT NULL,
  context TEXT,
  file_path TEXT,
  line_number INTEGER,
  replacement_suggestion VARCHAR(255),
  category VARCHAR(100), -- 'ui_label', 'variable_name', 'comment', 'database_field'
  is_critical BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for scan history
CREATE TABLE IF NOT EXISTS white_label_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_type VARCHAR(50), -- 'full', 'partial', 'golf_terms', 'dependencies'
  total_files_scanned INTEGER,
  golf_specific_found INTEGER,
  transferable_found INTEGER,
  duration_ms INTEGER,
  results JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_golf_terms_category ON golf_specific_terms(category);
CREATE INDEX IF NOT EXISTS idx_golf_terms_critical ON golf_specific_terms(is_critical);
CREATE INDEX IF NOT EXISTS idx_scans_type ON white_label_scans(scan_type);
CREATE INDEX IF NOT EXISTS idx_scans_created ON white_label_scans(created_at DESC);

-- DOWN
ALTER TABLE feature_inventory
DROP COLUMN IF EXISTS dependencies,
DROP COLUMN IF EXISTS code_locations,
DROP COLUMN IF EXISTS config_keys,
DROP COLUMN IF EXISTS file_count,
DROP COLUMN IF EXISTS line_count,
DROP COLUMN IF EXISTS last_scanned;

ALTER TABLE branding_inventory
DROP COLUMN IF EXISTS code_locations,
DROP COLUMN IF EXISTS file_count,
DROP COLUMN IF EXISTS last_scanned;

DROP TABLE IF EXISTS golf_specific_terms;
DROP TABLE IF EXISTS white_label_scans;