-- UP
-- Dynamic Checklists with UniFi Integration

-- 1. Create checklist templates table
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('cleaning', 'tech')),
  type VARCHAR(50) NOT NULL CHECK (type IN ('daily', 'weekly', 'quarterly')),
  location VARCHAR(255), -- NULL means template applies to all locations
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create checklist tasks table
CREATE TABLE IF NOT EXISTS checklist_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES checklist_templates(id) ON DELETE CASCADE,
  task_text VARCHAR(500) NOT NULL,
  position INT NOT NULL,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(template_id, position)
);

-- 3. Add new columns to checklist_submissions for tracking
ALTER TABLE checklist_submissions 
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES checklist_templates(id),
ADD COLUMN IF NOT EXISTS door_unlocked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS duration_minutes INT GENERATED ALWAYS AS (
  CASE 
    WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (completed_at - started_at))/60 
    ELSE NULL 
  END
) STORED,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'abandoned'));

-- 4. Create door unlock audit log
CREATE TABLE IF NOT EXISTS checklist_door_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  location VARCHAR(255) NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  checklist_submission_id UUID REFERENCES checklist_submissions(id),
  unifi_response JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Add location permissions to users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS allowed_locations TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_checklist_templates_location ON checklist_templates(location);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_category_type ON checklist_templates(category, type);
CREATE INDEX IF NOT EXISTS idx_checklist_tasks_template_position ON checklist_tasks(template_id, position);
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_template ON checklist_submissions(template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_status ON checklist_submissions(status);
CREATE INDEX IF NOT EXISTS idx_checklist_door_unlocks_user_location ON checklist_door_unlocks(user_id, location);

-- Insert default templates (migrating from hardcoded)
INSERT INTO checklist_templates (name, category, type, location) VALUES
  ('Daily Cleaning', 'cleaning', 'daily', NULL),
  ('Weekly Cleaning', 'cleaning', 'weekly', NULL),
  ('Quarterly Cleaning', 'cleaning', 'quarterly', NULL),
  ('Weekly Tech Maintenance', 'tech', 'weekly', NULL),
  ('Quarterly Tech Maintenance', 'tech', 'quarterly', NULL)
ON CONFLICT DO NOTHING;

-- Insert tasks for Daily Cleaning template
WITH daily_template AS (
  SELECT id FROM checklist_templates WHERE category = 'cleaning' AND type = 'daily' AND location IS NULL LIMIT 1
)
INSERT INTO checklist_tasks (template_id, task_text, position) 
SELECT 
  daily_template.id,
  task_text,
  position
FROM daily_template, (VALUES
  ('Replace practice balls', 1),
  ('Empty all garbage bins', 2),
  ('Clean and restock bathrooms', 3),
  ('Refill water stations', 4),
  ('Check and clean hitting mats', 5),
  ('Wipe down screens', 6)
) AS tasks(task_text, position)
ON CONFLICT DO NOTHING;

-- Insert tasks for Weekly Cleaning template
WITH weekly_template AS (
  SELECT id FROM checklist_templates WHERE category = 'cleaning' AND type = 'weekly' AND location IS NULL LIMIT 1
)
INSERT INTO checklist_tasks (template_id, task_text, position) 
SELECT 
  weekly_template.id,
  task_text,
  position
FROM weekly_template, (VALUES
  ('Deep clean all bays', 1),
  ('Vacuum entire facility', 2),
  ('Clean all windows', 3),
  ('Inspect and clean equipment', 4),
  ('Organize storage areas', 5),
  ('Check HVAC filters', 6)
) AS tasks(task_text, position)
ON CONFLICT DO NOTHING;

-- Insert tasks for Quarterly Cleaning template
WITH quarterly_template AS (
  SELECT id FROM checklist_templates WHERE category = 'cleaning' AND type = 'quarterly' AND location IS NULL LIMIT 1
)
INSERT INTO checklist_tasks (template_id, task_text, position) 
SELECT 
  quarterly_template.id,
  task_text,
  position
FROM quarterly_template, (VALUES
  ('Wash walls and touch-up paint', 1),
  ('Deep carpet cleaning', 2),
  ('Equipment maintenance check', 3),
  ('Complete inventory audit', 4),
  ('Safety equipment inspection', 5)
) AS tasks(task_text, position)
ON CONFLICT DO NOTHING;

-- Insert tasks for Weekly Tech template
WITH tech_weekly_template AS (
  SELECT id FROM checklist_templates WHERE category = 'tech' AND type = 'weekly' AND location IS NULL LIMIT 1
)
INSERT INTO checklist_tasks (template_id, task_text, position) 
SELECT 
  tech_weekly_template.id,
  task_text,
  position
FROM tech_weekly_template, (VALUES
  ('Update TrackMan software', 1),
  ('Check all cable connections', 2),
  ('Clean projector lenses', 3),
  ('Run system diagnostics', 4),
  ('Test network connectivity', 5),
  ('Verify backup systems', 6)
) AS tasks(task_text, position)
ON CONFLICT DO NOTHING;

-- Insert tasks for Quarterly Tech template
WITH tech_quarterly_template AS (
  SELECT id FROM checklist_templates WHERE category = 'tech' AND type = 'quarterly' AND location IS NULL LIMIT 1
)
INSERT INTO checklist_tasks (template_id, task_text, position) 
SELECT 
  tech_quarterly_template.id,
  task_text,
  position
FROM tech_quarterly_template, (VALUES
  ('Calibrate all TrackMan units', 1),
  ('Hardware inspection and cleaning', 2),
  ('Test UPS battery systems', 3),
  ('Review security footage retention', 4),
  ('Verify software licenses', 5),
  ('Update technical documentation', 6)
) AS tasks(task_text, position)
ON CONFLICT DO NOTHING;

-- Grant default location access to existing admin users
UPDATE users 
SET allowed_locations = ARRAY['Bedford', 'Dartmouth', 'Stratford', 'Bayers Lake', 'Truro']
WHERE role = 'admin' AND allowed_locations IS NULL;

-- DOWN
-- Remove all dynamic checklist additions
DROP TABLE IF EXISTS checklist_door_unlocks CASCADE;
DROP TABLE IF EXISTS checklist_tasks CASCADE;
DROP TABLE IF EXISTS checklist_templates CASCADE;

ALTER TABLE checklist_submissions 
DROP COLUMN IF EXISTS template_id,
DROP COLUMN IF EXISTS door_unlocked_at,
DROP COLUMN IF EXISTS started_at,
DROP COLUMN IF EXISTS completed_at,
DROP COLUMN IF EXISTS duration_minutes,
DROP COLUMN IF EXISTS status;

ALTER TABLE users 
DROP COLUMN IF EXISTS allowed_locations;