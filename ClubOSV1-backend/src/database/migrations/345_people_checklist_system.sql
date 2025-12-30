-- UP
-- People Checklist System - Weekly Rolling Task Management
-- Adds a "People" category for managing weekly task lists per named individual

-- 1. Create checklist_persons table - Named staff members (NOT system users)
CREATE TABLE IF NOT EXISTS checklist_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#0B3D3A',
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name)
);

-- 2. Create checklist_person_tasks table - Tasks per person organized by day of week
CREATE TABLE IF NOT EXISTS checklist_person_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES checklist_persons(id) ON DELETE CASCADE,
  task_text VARCHAR(500) NOT NULL,
  day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  position INT NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create checklist_person_weekly_submissions table - One per person per week
CREATE TABLE IF NOT EXISTS checklist_person_weekly_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES checklist_persons(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  user_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('pending', 'in_progress', 'completed', 'abandoned')),
  started_at TIMESTAMP,
  submitted_at TIMESTAMP,
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(person_id, week_start)
);

-- 4. Create checklist_person_task_completions table - Individual task completions
CREATE TABLE IF NOT EXISTS checklist_person_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES checklist_person_weekly_submissions(id) ON DELETE CASCADE,
  task_id UUID REFERENCES checklist_person_tasks(id) ON DELETE CASCADE,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_by UUID REFERENCES users(id),
  notes TEXT,
  UNIQUE(submission_id, task_id)
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_person_tasks_person_day ON checklist_person_tasks(person_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_person_tasks_active ON checklist_person_tasks(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_person_weekly_submissions_person ON checklist_person_weekly_submissions(person_id);
CREATE INDEX IF NOT EXISTS idx_person_weekly_submissions_week ON checklist_person_weekly_submissions(week_start);
CREATE INDEX IF NOT EXISTS idx_person_weekly_submissions_status ON checklist_person_weekly_submissions(status);
CREATE INDEX IF NOT EXISTS idx_person_task_completions_submission ON checklist_person_task_completions(submission_id);
CREATE INDEX IF NOT EXISTS idx_checklist_persons_active ON checklist_persons(active) WHERE active = true;

-- DOWN
-- DROP TABLE IF EXISTS checklist_person_task_completions CASCADE;
-- DROP TABLE IF EXISTS checklist_person_weekly_submissions CASCADE;
-- DROP TABLE IF EXISTS checklist_person_tasks CASCADE;
-- DROP TABLE IF EXISTS checklist_persons CASCADE;
