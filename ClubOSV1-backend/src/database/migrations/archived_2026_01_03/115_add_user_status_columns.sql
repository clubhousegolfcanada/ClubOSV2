-- Migration: Add missing columns to users table for user status management
-- This fixes the "column status does not exist" error when creating new users

-- Add status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='status') THEN
        ALTER TABLE users 
        ADD COLUMN status VARCHAR(20) DEFAULT 'active' 
        CHECK (status IN ('active', 'pending_approval', 'suspended', 'rejected'));
    END IF;
END $$;

-- Add signup_date column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='signup_date') THEN
        ALTER TABLE users 
        ADD COLUMN signup_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Add signup_metadata column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='signup_metadata') THEN
        ALTER TABLE users 
        ADD COLUMN signup_metadata JSONB DEFAULT '{}';
    END IF;
END $$;

-- Create index on status for pending approval queries
CREATE INDEX IF NOT EXISTS idx_users_status 
ON users(status) 
WHERE status = 'pending_approval';

-- Update existing users to have 'active' status if null
UPDATE users 
SET status = 'active' 
WHERE status IS NULL;

-- Add comment to explain the status column
COMMENT ON COLUMN users.status IS 'User account status: active (approved), pending_approval (awaiting admin approval), suspended (temporarily disabled), rejected (signup denied)';
COMMENT ON COLUMN users.signup_date IS 'Timestamp when the user signed up';
COMMENT ON COLUMN users.signup_metadata IS 'Additional metadata captured during signup (IP address, referrer, etc)';