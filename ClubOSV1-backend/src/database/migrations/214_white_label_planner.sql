-- Migration: Create white label planner tables
-- Description: Tables for analyzing and planning white label implementations

-- UP
CREATE TABLE IF NOT EXISTS white_label_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  features JSONB DEFAULT '{}',
  branding JSONB DEFAULT '{}',
  sops JSONB DEFAULT '{}',
  integrations JSONB DEFAULT '{}',
  excluded_features JSONB DEFAULT '[]',
  implementation_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS feature_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(100) NOT NULL,
  is_transferable BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS branding_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  element_type VARCHAR(255) NOT NULL UNIQUE,
  current_value TEXT,
  is_customizable BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sop_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(100),
  is_industry_specific BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS integration_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(100),
  is_required BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_feature_inventory_category ON feature_inventory(category);
CREATE INDEX idx_feature_inventory_transferable ON feature_inventory(is_transferable);
CREATE INDEX idx_branding_inventory_type ON branding_inventory(element_type);
CREATE INDEX idx_sop_inventory_category ON sop_inventory(category);
CREATE INDEX idx_integration_inventory_type ON integration_inventory(type);

-- DOWN
DROP TABLE IF EXISTS white_label_configurations;
DROP TABLE IF EXISTS feature_inventory;
DROP TABLE IF EXISTS branding_inventory;
DROP TABLE IF EXISTS sop_inventory;
DROP TABLE IF EXISTS integration_inventory;