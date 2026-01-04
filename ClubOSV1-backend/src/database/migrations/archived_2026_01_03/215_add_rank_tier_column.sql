-- Migration: Add rank_tier column to customer_profiles
-- Description: Adds missing rank_tier column that's being referenced in challenges

-- UP
ALTER TABLE customer_profiles 
ADD COLUMN IF NOT EXISTS rank_tier VARCHAR(50) DEFAULT 'Bronze';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_customer_profiles_rank_tier ON customer_profiles(rank_tier);

-- DOWN
ALTER TABLE customer_profiles DROP COLUMN IF EXISTS rank_tier;