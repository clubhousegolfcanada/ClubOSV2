-- Migration: Add export jobs table for async bulk exports
-- This allows exporting large numbers of receipts without timeout

CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed, cancelled
  export_type VARCHAR(20) NOT NULL,       -- receipts, tickets, etc.
  filters JSONB,                          -- period, format, date range, etc.
  total_items INTEGER,                    -- total count for progress tracking
  processed_items INTEGER DEFAULT 0,      -- current progress
  file_path TEXT,                         -- path to completed export file (temp storage)
  file_size INTEGER,                      -- size in bytes
  error_message TEXT,                     -- error details if failed
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,                   -- when processing began
  completed_at TIMESTAMP,                 -- when processing finished
  expires_at TIMESTAMP                    -- auto-cleanup after 24 hours
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_export_jobs_user ON export_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_expires ON export_jobs(expires_at) WHERE status = 'completed';

-- Comment explaining the table
COMMENT ON TABLE export_jobs IS 'Tracks async export jobs for bulk receipt/ticket downloads';
