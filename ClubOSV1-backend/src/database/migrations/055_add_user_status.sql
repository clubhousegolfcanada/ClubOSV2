-- Add status column to users table for signup approval workflow
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'pending_approval', 'suspended', 'rejected'));

-- Add signup metadata column to track registration details
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS signup_metadata JSONB DEFAULT '{}';

-- Update existing users to have 'active' status
UPDATE users SET status = 'active' WHERE status IS NULL;

-- Create index for faster queries on pending users
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status) WHERE status = 'pending_approval';

-- Add signup_date column for tracking when users registered
ALTER TABLE users
ADD COLUMN IF NOT EXISTS signup_date TIMESTAMP DEFAULT NOW();

-- Update existing users to have signup_date as their created_at
UPDATE users SET signup_date = created_at WHERE signup_date IS NULL;