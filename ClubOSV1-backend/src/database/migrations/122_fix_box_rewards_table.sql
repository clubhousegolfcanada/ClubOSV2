-- Migration: Fix missing columns in production
-- Fixes box_rewards table and customer_profiles highest_rank column

-- Create box_rewards table if it doesn't exist
CREATE TABLE IF NOT EXISTS box_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    box_id UUID NOT NULL,
    reward_type VARCHAR(50) NOT NULL,
    reward_name VARCHAR(255) NOT NULL,
    reward_value JSONB NOT NULL,
    voucher_code VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns if the table already exists but is missing columns
DO $$ 
BEGIN
    -- Add reward_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'box_rewards' 
                   AND column_name = 'reward_name') THEN
        ALTER TABLE box_rewards ADD COLUMN reward_name VARCHAR(255) NOT NULL DEFAULT 'Unknown Reward';
    END IF;
    
    -- Add reward_value column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'box_rewards' 
                   AND column_name = 'reward_value') THEN
        ALTER TABLE box_rewards ADD COLUMN reward_value JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    
    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'box_rewards' 
                   AND constraint_type = 'FOREIGN KEY'
                   AND constraint_name = 'box_rewards_box_id_fkey') THEN
        ALTER TABLE box_rewards 
        ADD CONSTRAINT box_rewards_box_id_fkey 
        FOREIGN KEY (box_id) REFERENCES boxes(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_box_rewards_box ON box_rewards(box_id);

-- Fix missing highest_rank column in customer_profiles
DO $$ 
BEGIN
    -- Add highest_rank column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customer_profiles' 
                   AND column_name = 'highest_rank') THEN
        ALTER TABLE customer_profiles ADD COLUMN highest_rank INTEGER DEFAULT 1;
    END IF;
    
    -- Add highest_rank_achieved_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customer_profiles' 
                   AND column_name = 'highest_rank_achieved_at') THEN
        ALTER TABLE customer_profiles ADD COLUMN highest_rank_achieved_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;