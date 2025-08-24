-- Add status column to Users table for signup approval workflow
ALTER TABLE "Users" 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'pending_approval', 'suspended', 'rejected'));

-- Add signup metadata column to track registration details
ALTER TABLE "Users" 
ADD COLUMN IF NOT EXISTS signup_metadata JSONB DEFAULT '{}';

-- Update existing users to have 'active' status
UPDATE "Users" SET status = 'active' WHERE status IS NULL;

-- Create index for faster queries on pending users
CREATE INDEX IF NOT EXISTS idx_users_status ON "Users"(status) WHERE status = 'pending_approval';

-- Add signup_date column for tracking when users registered
ALTER TABLE "Users"
ADD COLUMN IF NOT EXISTS signup_date TIMESTAMP DEFAULT NOW();

-- Update existing users to have signup_date as their created_at
UPDATE "Users" SET signup_date = "createdAt" WHERE signup_date IS NULL;

-- Add customer role to role constraint
ALTER TABLE "Users" 
DROP CONSTRAINT IF EXISTS valid_role;

ALTER TABLE "Users" 
ADD CONSTRAINT valid_role 
CHECK (role IN ('admin', 'operator', 'support', 'kiosk', 'customer'));