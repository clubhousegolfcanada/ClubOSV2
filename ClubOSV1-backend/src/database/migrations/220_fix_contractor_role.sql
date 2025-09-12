-- Migration 220: Fix contractor role in users table constraint
-- This properly adds contractor to the valid roles

-- Drop the existing constraint (if it exists)
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add the updated constraint including contractor
ALTER TABLE users ADD CONSTRAINT valid_role 
  CHECK (role IN ('admin', 'operator', 'support', 'kiosk', 'customer', 'contractor'));

-- Create contractor permissions table if not exists
CREATE TABLE IF NOT EXISTS contractor_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location VARCHAR(100) NOT NULL,
  can_unlock_doors BOOLEAN DEFAULT true,
  can_submit_checklists BOOLEAN DEFAULT true,
  can_view_history BOOLEAN DEFAULT false,
  active_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  UNIQUE(user_id, location)
);

-- Create indexes if not exists
CREATE INDEX IF NOT EXISTS idx_contractor_permissions_user_location 
  ON contractor_permissions(user_id, location);
CREATE INDEX IF NOT EXISTS idx_contractor_permissions_active 
  ON contractor_permissions(active_from, active_until);

-- Create contractor checklist submissions table if not exists
CREATE TABLE IF NOT EXISTS contractor_checklist_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES users(id),
  checklist_submission_id UUID REFERENCES checklist_submissions(id),
  location VARCHAR(100) NOT NULL,
  door_unlocks JSONB DEFAULT '[]',
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes if not exists
CREATE INDEX IF NOT EXISTS idx_contractor_submissions_contractor 
  ON contractor_checklist_submissions(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_submissions_location 
  ON contractor_checklist_submissions(contractor_id, location);