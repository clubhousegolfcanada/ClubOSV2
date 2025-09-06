-- Migration: Create white label planner tables
-- Description: Tables for analyzing and planning white label implementations

-- UP
CREATE TABLE IF NOT EXISTS white_label_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  features JSONB DEFAULT '{}',
  branding_items JSONB DEFAULT '[]',
  sop_replacements JSONB DEFAULT '[]',
  integrations JSONB DEFAULT '[]',
  excluded_features JSONB DEFAULT '[]',
  implementation_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS feature_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100) NOT NULL,
  feature_name VARCHAR(255) NOT NULL,
  description TEXT,
  is_clubos_specific BOOLEAN DEFAULT false,
  is_transferable BOOLEAN DEFAULT true,
  dependencies JSONB DEFAULT '[]',
  configuration_options JSONB DEFAULT '{}',
  file_locations JSONB DEFAULT '[]',
  database_tables JSONB DEFAULT '[]',
  api_endpoints JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS branding_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL, -- 'logo', 'color', 'text', 'image', 'name'
  location VARCHAR(500) NOT NULL,
  current_value TEXT,
  is_hardcoded BOOLEAN DEFAULT false,
  replacement_strategy TEXT,
  file_path TEXT,
  line_number INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sop_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100), -- 'checklist', 'knowledge_base', 'automation', 'workflow'
  description TEXT,
  location JSONB DEFAULT '{}',
  is_replaceable BOOLEAN DEFAULT true,
  replacement_template TEXT,
  dependencies JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS integration_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name VARCHAR(255) NOT NULL,
  type VARCHAR(100), -- 'payment', 'communication', 'analytics', 'automation', 'facility'
  is_required BOOLEAN DEFAULT false,
  is_client_specific BOOLEAN DEFAULT false,
  configuration JSONB DEFAULT '{}',
  api_keys_required JSONB DEFAULT '[]',
  webhook_urls JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_feature_inventory_category ON feature_inventory(category);
CREATE INDEX idx_feature_inventory_clubos_specific ON feature_inventory(is_clubos_specific);
CREATE INDEX idx_branding_inventory_type ON branding_inventory(type);
CREATE INDEX idx_integration_inventory_type ON integration_inventory(type);

-- DOWN
DROP TABLE IF EXISTS white_label_configurations;
DROP TABLE IF EXISTS feature_inventory;
DROP TABLE IF EXISTS branding_inventory;
DROP TABLE IF EXISTS sop_inventory;
DROP TABLE IF EXISTS integration_inventory;