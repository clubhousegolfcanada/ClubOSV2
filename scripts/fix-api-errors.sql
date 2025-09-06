-- Fix API Errors Script
-- Date: September 6, 2025
-- Purpose: Fix 500 errors on logout and cc-balance endpoints

-- ============================================
-- FIX 1: Add missing columns to blacklisted_tokens table
-- ============================================
ALTER TABLE blacklisted_tokens 
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Verify the table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'blacklisted_tokens'
ORDER BY ordinal_position;

-- ============================================
-- FIX 2: Create logs table for frontend logging (if missing)
-- ============================================
CREATE TABLE IF NOT EXISTS frontend_logs (
  id SERIAL PRIMARY KEY,
  level VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  context JSONB,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frontend_logs_created ON frontend_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_frontend_logs_user ON frontend_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_frontend_logs_level ON frontend_logs(level);

-- ============================================
-- FIX 3: Check cc-balance issue - likely user_id type mismatch
-- ============================================
-- Check if the user exists
SELECT id, email, role, clubcoins_balance 
FROM users 
WHERE id = '56dd6356-30be-45a2-9812-fe6858f907a2'::uuid
LIMIT 1;

-- If no user found, the issue is the user doesn't exist
-- If user found, check challenges table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'challenge_participants'
AND column_name = 'user_id';

-- ============================================
-- FIX 4: Ensure challenge_participants has correct user_id type
-- ============================================
-- Check if we need to fix the user_id column type
DO $$
BEGIN
  -- Only run if the column exists but is wrong type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'challenge_participants' 
    AND column_name = 'user_id'
    AND data_type != 'uuid'
  ) THEN
    -- Fix the column type
    ALTER TABLE challenge_participants 
    ALTER COLUMN user_id TYPE UUID USING user_id::uuid;
  END IF;
END $$;

-- ============================================
-- Success message
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'API error fixes applied successfully!';
  RAISE NOTICE '1. blacklisted_tokens table updated with missing columns';
  RAISE NOTICE '2. frontend_logs table created (if missing)';
  RAISE NOTICE '3. User/challenges structure verified';
END $$;