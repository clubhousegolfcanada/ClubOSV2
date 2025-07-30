-- Create table for storing admin customizations of checklist tasks
CREATE TABLE IF NOT EXISTS checklist_task_customizations (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL CHECK (category IN ('cleaning', 'tech')),
    type VARCHAR(50) NOT NULL CHECK (type IN ('daily', 'weekly', 'quarterly')),
    task_id VARCHAR(100) NOT NULL,
    custom_label TEXT NOT NULL,
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category, type, task_id)
);

-- Index for fast lookups when loading templates
CREATE INDEX idx_checklist_customizations_lookup 
ON checklist_task_customizations(category, type);

-- Add comment for documentation
COMMENT ON TABLE checklist_task_customizations IS 'Stores admin-customized labels for checklist tasks. Original templates remain hardcoded.';