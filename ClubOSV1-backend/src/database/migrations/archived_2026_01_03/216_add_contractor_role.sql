-- UP
-- Add contractor role to users table constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'operator', 'support', 'kiosk', 'customer', 'contractor'));

-- Create contractor_permissions table for granular control
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

-- Add indexes for performance
CREATE INDEX idx_contractor_permissions_user_location ON contractor_permissions(user_id, location);
CREATE INDEX idx_contractor_permissions_active ON contractor_permissions(active_from, active_until);

-- Track contractor checklist submissions separately for auditing
CREATE TABLE IF NOT EXISTS contractor_checklist_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES users(id),
  checklist_submission_id UUID REFERENCES checklist_submissions(id),
  location VARCHAR(100) NOT NULL,
  door_unlocks JSONB DEFAULT '[]', -- Track which doors were unlocked
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for contractor submissions
CREATE INDEX idx_contractor_submissions_contractor ON contractor_checklist_submissions(contractor_id);
CREATE INDEX idx_contractor_submissions_location ON contractor_checklist_submissions(contractor_id, location);

-- DOWN
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'operator', 'support', 'kiosk', 'customer'));
DROP TABLE IF EXISTS contractor_checklist_submissions;
DROP TABLE IF EXISTS contractor_permissions;