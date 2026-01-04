-- UP
-- Enhanced Checklists with Supplies Tracking, Photos, and QR Codes

-- 1. Add supplies tracking to checklist tasks
ALTER TABLE checklist_tasks
ADD COLUMN IF NOT EXISTS supplies_needed TEXT,
ADD COLUMN IF NOT EXISTS supplies_urgency VARCHAR(20) CHECK (supplies_urgency IN ('low', 'medium', 'high'));

-- 2. Add photo capabilities to submissions
ALTER TABLE checklist_submissions
ADD COLUMN IF NOT EXISTS photo_urls TEXT[],
ADD COLUMN IF NOT EXISTS supplies_requested JSONB,
ADD COLUMN IF NOT EXISTS qr_code_accessed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS qr_code_accessed_at TIMESTAMP;

-- 3. Create QR code tracking table
CREATE TABLE IF NOT EXISTS checklist_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES checklist_templates(id) ON DELETE CASCADE,
  location VARCHAR(255),
  qr_code_data TEXT NOT NULL,
  short_url VARCHAR(255) UNIQUE,
  scan_count INT DEFAULT 0,
  last_scanned_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create performance tracking table
CREATE TABLE IF NOT EXISTS checklist_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  location VARCHAR(255),
  template_id UUID REFERENCES checklist_templates(id),
  week_start DATE NOT NULL,
  completions_count INT DEFAULT 0,
  avg_duration_minutes FLOAT,
  on_time_count INT DEFAULT 0,
  late_count INT DEFAULT 0,
  supplies_reported_count INT DEFAULT 0,
  photos_uploaded_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, location, template_id, week_start)
);

-- 5. Create supplies request tracking
CREATE TABLE IF NOT EXISTS checklist_supplies_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES checklist_submissions(id),
  task_id UUID REFERENCES checklist_tasks(id),
  supplies_description TEXT NOT NULL,
  urgency VARCHAR(20) NOT NULL CHECK (urgency IN ('low', 'medium', 'high')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'delivered', 'cancelled')),
  requested_by UUID REFERENCES users(id),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Add template cloning metadata
ALTER TABLE checklist_templates
ADD COLUMN IF NOT EXISTS parent_template_id UUID REFERENCES checklist_templates(id),
ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS qr_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS photo_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS max_duration_minutes INT;

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_checklist_qr_codes_template ON checklist_qr_codes(template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_qr_codes_location ON checklist_qr_codes(location);
CREATE INDEX IF NOT EXISTS idx_checklist_performance_user_week ON checklist_performance(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_checklist_performance_location ON checklist_performance(location);
CREATE INDEX IF NOT EXISTS idx_checklist_supplies_status ON checklist_supplies_requests(status);
CREATE INDEX IF NOT EXISTS idx_checklist_supplies_urgency ON checklist_supplies_requests(urgency);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_parent ON checklist_templates(parent_template_id);

-- 8. Add sample supplies to existing tasks
UPDATE checklist_tasks 
SET supplies_needed = 'Paper towels, cleaning spray', supplies_urgency = 'medium'
WHERE task_text = 'Wipe down screens';

UPDATE checklist_tasks 
SET supplies_needed = 'Toilet paper, hand soap, paper towels', supplies_urgency = 'high'
WHERE task_text = 'Clean and restock bathrooms';

UPDATE checklist_tasks 
SET supplies_needed = 'Vacuum bags', supplies_urgency = 'low'
WHERE task_text = 'Vacuum entire facility';

UPDATE checklist_tasks 
SET supplies_needed = 'HVAC filters (20x25x1)', supplies_urgency = 'medium'
WHERE task_text = 'Check HVAC filters';

-- DOWN
-- Remove enhanced checklist features
DROP TABLE IF EXISTS checklist_supplies_requests CASCADE;
DROP TABLE IF EXISTS checklist_performance CASCADE;
DROP TABLE IF EXISTS checklist_qr_codes CASCADE;

ALTER TABLE checklist_tasks
DROP COLUMN IF EXISTS supplies_needed,
DROP COLUMN IF EXISTS supplies_urgency;

ALTER TABLE checklist_submissions
DROP COLUMN IF EXISTS photo_urls,
DROP COLUMN IF EXISTS supplies_requested,
DROP COLUMN IF EXISTS qr_code_accessed,
DROP COLUMN IF EXISTS qr_code_accessed_at;

ALTER TABLE checklist_templates
DROP COLUMN IF EXISTS parent_template_id,
DROP COLUMN IF EXISTS is_master,
DROP COLUMN IF EXISTS qr_enabled,
DROP COLUMN IF EXISTS photo_required,
DROP COLUMN IF EXISTS max_duration_minutes;