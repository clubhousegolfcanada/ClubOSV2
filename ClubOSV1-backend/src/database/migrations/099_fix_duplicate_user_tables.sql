-- Migration: Fix duplicate user tables issue
-- This migration consolidates the duplicate user tables (Users and users) into a single Users table

-- Step 1: Check for users in lowercase table that don't exist in uppercase table
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Count users that need to be migrated
    SELECT COUNT(*) INTO v_count
    FROM users u
    WHERE NOT EXISTS (
        SELECT 1 FROM "Users" U 
        WHERE LOWER(U.email) = LOWER(u.email)
    );
    
    RAISE NOTICE 'Found % users to migrate from users to Users table', v_count;
    
    -- Migrate users that don't exist in Users table
    INSERT INTO "Users" (id, email, name, phone, password, role, status, "createdAt", "updatedAt")
    SELECT 
        u.id,
        LOWER(u.email),
        u.name,
        u.phone,
        u.password,
        CASE 
            WHEN u.role = 'customer' THEN 'customer'::"enum_Users_role"
            WHEN u.role = 'admin' THEN 'admin'::"enum_Users_role"
            WHEN u.role = 'operator' THEN 'operator'::"enum_Users_role"
            ELSE 'customer'::"enum_Users_role"
        END,
        COALESCE(u.status, 'active'),
        COALESCE(u.created_at, CURRENT_TIMESTAMP),
        COALESCE(u.updated_at, CURRENT_TIMESTAMP)
    FROM users u
    WHERE NOT EXISTS (
        SELECT 1 FROM "Users" U 
        WHERE LOWER(U.email) = LOWER(u.email)
    );
    
    RAISE NOTICE 'Migration completed. Migrated % users', v_count;
END $$;

-- Step 2: Update friendships table to ensure all user_ids exist in Users table
-- First, remove any friendships with invalid user references
DELETE FROM friendships 
WHERE user_id NOT IN (SELECT id FROM "Users")
   OR friend_id NOT IN (SELECT id FROM "Users");

-- Step 3: Fix foreign key constraints that reference the wrong table
-- Drop and recreate friend_invitations table with correct references
ALTER TABLE IF EXISTS friend_invitations DROP CONSTRAINT IF EXISTS friend_invitations_inviter_id_fkey;
ALTER TABLE IF EXISTS friend_invitations DROP CONSTRAINT IF EXISTS friend_invitations_accepted_user_id_fkey;

-- Add correct foreign key constraints
ALTER TABLE friend_invitations 
    ADD CONSTRAINT friend_invitations_inviter_id_fkey 
    FOREIGN KEY (inviter_id) REFERENCES "Users"(id) ON DELETE CASCADE;
    
ALTER TABLE friend_invitations 
    ADD CONSTRAINT friend_invitations_accepted_user_id_fkey 
    FOREIGN KEY (accepted_user_id) REFERENCES "Users"(id) ON DELETE CASCADE;

-- Step 4: Fix other tables that might reference users (lowercase)
-- user_blocks
ALTER TABLE IF EXISTS user_blocks DROP CONSTRAINT IF EXISTS user_blocks_user_id_fkey;
ALTER TABLE IF EXISTS user_blocks DROP CONSTRAINT IF EXISTS user_blocks_blocked_user_id_fkey;

ALTER TABLE user_blocks 
    ADD CONSTRAINT user_blocks_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES "Users"(id) ON DELETE CASCADE;
    
ALTER TABLE user_blocks 
    ADD CONSTRAINT user_blocks_blocked_user_id_fkey 
    FOREIGN KEY (blocked_user_id) REFERENCES "Users"(id) ON DELETE CASCADE;

-- Step 5: Add check constraint to prevent self-friending if not exists
ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_no_self_friend;
ALTER TABLE friendships ADD CONSTRAINT friendships_no_self_friend CHECK (user_id != friend_id);

-- Step 6: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- Step 7: Drop the duplicate users table (commented out for safety - run manually after verification)
-- DROP TABLE IF EXISTS users CASCADE;

-- Add a comment to remember this migration
COMMENT ON TABLE "Users" IS 'Main users table - consolidated from duplicate users/Users tables in migration 099';