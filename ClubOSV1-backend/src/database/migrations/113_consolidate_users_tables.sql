-- UP
-- Consolidate dual users tables into single lowercase 'users' table

-- Step 1: Add missing columns from Users to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS signup_metadata JSONB,
ADD COLUMN IF NOT EXISTS signup_date TIMESTAMP;

-- Step 2: Sync all data from Users to users
INSERT INTO users (id, email, password, name, role, phone, created_at, updated_at, last_login, is_active, status, signup_metadata, signup_date)
SELECT 
  id, 
  email, 
  password, 
  name, 
  role, 
  phone,
  "createdAt" as created_at,
  "updatedAt" as updated_at,
  COALESCE("lastLogin", last_login) as last_login,
  COALESCE("isActive", true) as is_active,
  COALESCE(status, 'active') as status,
  signup_metadata,
  signup_date
FROM "Users"
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  password = EXCLUDED.password,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone,
  updated_at = EXCLUDED.updated_at,
  last_login = EXCLUDED.last_login,
  is_active = EXCLUDED.is_active,
  status = EXCLUDED.status,
  signup_metadata = EXCLUDED.signup_metadata,
  signup_date = EXCLUDED.signup_date;

-- Step 3: Update all foreign key constraints to point to users instead of Users
-- We need to drop and recreate constraints

-- 3a. Challenge related tables
ALTER TABLE challenges 
  DROP CONSTRAINT IF EXISTS challenges_creator_id_fkey,
  DROP CONSTRAINT IF EXISTS challenges_acceptor_id_fkey,
  DROP CONSTRAINT IF EXISTS challenges_winner_user_id_fkey;

ALTER TABLE challenges
  ADD CONSTRAINT challenges_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT challenges_acceptor_id_fkey FOREIGN KEY (acceptor_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT challenges_winner_user_id_fkey FOREIGN KEY (winner_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3b. Customer profiles
ALTER TABLE customer_profiles
  DROP CONSTRAINT IF EXISTS customer_profiles_user_id_fkey;
ALTER TABLE customer_profiles
  ADD CONSTRAINT customer_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 3c. CC transactions
ALTER TABLE cc_transactions
  DROP CONSTRAINT IF EXISTS cc_transactions_user_id_fkey;
ALTER TABLE cc_transactions
  ADD CONSTRAINT cc_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 3d. Stakes
ALTER TABLE stakes
  DROP CONSTRAINT IF EXISTS stakes_user_id_fkey;
ALTER TABLE stakes
  ADD CONSTRAINT stakes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 3e. Champion markers
ALTER TABLE champion_markers
  DROP CONSTRAINT IF EXISTS champion_markers_user_id_fkey;
ALTER TABLE champion_markers
  ADD CONSTRAINT champion_markers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 3f. User badges
ALTER TABLE user_badges
  DROP CONSTRAINT IF EXISTS user_badges_user_id_fkey;
ALTER TABLE user_badges
  ADD CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 3g. Badge progress
ALTER TABLE badge_progress
  DROP CONSTRAINT IF EXISTS badge_progress_user_id_fkey;
ALTER TABLE badge_progress
  ADD CONSTRAINT badge_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 3h. Challenge audit
ALTER TABLE challenge_audit
  DROP CONSTRAINT IF EXISTS challenge_audit_user_id_fkey;
ALTER TABLE challenge_audit
  ADD CONSTRAINT challenge_audit_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 3i. Challenge disputes
ALTER TABLE challenge_disputes
  DROP CONSTRAINT IF EXISTS challenge_disputes_filed_by_fkey,
  DROP CONSTRAINT IF EXISTS challenge_disputes_filed_against_fkey,
  DROP CONSTRAINT IF EXISTS challenge_disputes_reviewed_by_fkey;
ALTER TABLE challenge_disputes
  ADD CONSTRAINT challenge_disputes_filed_by_fkey FOREIGN KEY (filed_by) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT challenge_disputes_filed_against_fkey FOREIGN KEY (filed_against) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT challenge_disputes_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

-- 3j. Challenge no shows
ALTER TABLE challenge_no_shows
  DROP CONSTRAINT IF EXISTS challenge_no_shows_user_id_fkey;
ALTER TABLE challenge_no_shows
  ADD CONSTRAINT challenge_no_shows_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 3k. Challenge plays
ALTER TABLE challenge_plays
  DROP CONSTRAINT IF EXISTS challenge_plays_user_id_fkey;
ALTER TABLE challenge_plays
  ADD CONSTRAINT challenge_plays_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 3l. Challenge results
ALTER TABLE challenge_results
  DROP CONSTRAINT IF EXISTS challenge_results_winner_user_id_fkey,
  DROP CONSTRAINT IF EXISTS challenge_results_loser_user_id_fkey,
  DROP CONSTRAINT IF EXISTS challenge_results_resolved_by_fkey;
ALTER TABLE challenge_results
  ADD CONSTRAINT challenge_results_winner_user_id_fkey FOREIGN KEY (winner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT challenge_results_loser_user_id_fkey FOREIGN KEY (loser_user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT challenge_results_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL;

-- 3m. Conversation sessions
ALTER TABLE conversation_sessions
  DROP CONSTRAINT IF EXISTS conversation_sessions_user_id_fkey;
ALTER TABLE conversation_sessions
  ADD CONSTRAINT conversation_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 3n. Friend invitations
ALTER TABLE friend_invitations
  DROP CONSTRAINT IF EXISTS friend_invitations_inviter_id_fkey,
  DROP CONSTRAINT IF EXISTS friend_invitations_accepted_user_id_fkey;
ALTER TABLE friend_invitations
  ADD CONSTRAINT friend_invitations_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT friend_invitations_accepted_user_id_fkey FOREIGN KEY (accepted_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 3o. Rank assignments
ALTER TABLE rank_assignments
  DROP CONSTRAINT IF EXISTS rank_assignments_user_id_fkey;
ALTER TABLE rank_assignments
  ADD CONSTRAINT rank_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 3p. Seasonal CC earnings
ALTER TABLE seasonal_cc_earnings
  DROP CONSTRAINT IF EXISTS seasonal_cc_earnings_user_id_fkey;
ALTER TABLE seasonal_cc_earnings
  ADD CONSTRAINT seasonal_cc_earnings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 3q. System settings
ALTER TABLE system_settings
  DROP CONSTRAINT IF EXISTS system_settings_updated_by_fkey;
ALTER TABLE system_settings
  ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- 3r. User blocks
ALTER TABLE user_blocks
  DROP CONSTRAINT IF EXISTS user_blocks_user_id_fkey,
  DROP CONSTRAINT IF EXISTS user_blocks_blocked_user_id_fkey;
ALTER TABLE user_blocks
  ADD CONSTRAINT user_blocks_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT user_blocks_blocked_user_id_fkey FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 4: Drop the old Users table
DROP TABLE IF EXISTS "Users" CASCADE;

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);

-- DOWN
-- This is a one-way migration - we're not going back to dual tables
-- If needed, restore from backup