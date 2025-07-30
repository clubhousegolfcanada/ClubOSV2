-- Create checklist_submissions table for tracking completed checklists
CREATE TABLE IF NOT EXISTS checklist_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL CHECK (category IN ('cleaning', 'tech')),
  type VARCHAR(50) NOT NULL CHECK (type IN ('daily', 'weekly', 'quarterly')),
  location VARCHAR(100) NOT NULL,
  completed_tasks JSONB NOT NULL DEFAULT '[]',
  total_tasks INTEGER NOT NULL,
  completion_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_checklist_submissions_user_id ON checklist_submissions(user_id);
CREATE INDEX idx_checklist_submissions_category ON checklist_submissions(category);
CREATE INDEX idx_checklist_submissions_type ON checklist_submissions(type);
CREATE INDEX idx_checklist_submissions_location ON checklist_submissions(location);
CREATE INDEX idx_checklist_submissions_completion_time ON checklist_submissions(completion_time DESC);

-- Create a view for easy reporting
CREATE OR REPLACE VIEW checklist_submission_summary AS
SELECT 
  cs.id,
  cs.category,
  cs.type,
  cs.location,
  cs.total_tasks,
  cs.completion_time,
  u.name as user_name,
  u.email as user_email
FROM checklist_submissions cs
JOIN users u ON cs.user_id = u.id
ORDER BY cs.completion_time DESC;