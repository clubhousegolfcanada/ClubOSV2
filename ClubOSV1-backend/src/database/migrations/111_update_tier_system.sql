-- UP
-- Update rank tier system from 4 tiers to 5 tiers with new names

-- Step 1: Create new enum type
CREATE TYPE rank_tier_new AS ENUM ('junior', 'house', 'amateur', 'pro', 'master');

-- Step 2: Add temporary column for transition
ALTER TABLE customer_profiles 
ADD COLUMN rank_tier_new rank_tier_new;

-- Step 3: Map old values to new values
UPDATE customer_profiles
SET rank_tier_new = CASE
  WHEN rank_tier = 'house' THEN 'junior'::rank_tier_new
  WHEN rank_tier = 'putter' THEN 'house'::rank_tier_new
  WHEN rank_tier = 'iron' THEN 'amateur'::rank_tier_new
  WHEN rank_tier = 'driver' THEN 'pro'::rank_tier_new
  ELSE 'junior'::rank_tier_new
END
WHERE rank_tier IS NOT NULL;

-- Step 4: Drop old column and rename new one
ALTER TABLE customer_profiles DROP COLUMN rank_tier;
ALTER TABLE customer_profiles RENAME COLUMN rank_tier_new TO rank_tier;

-- Step 5: Drop old enum and rename new one
DROP TYPE IF EXISTS rank_tier CASCADE;
ALTER TYPE rank_tier_new RENAME TO rank_tier;

-- Step 6: Update tiers based on total_cc_earned with new thresholds
UPDATE customer_profiles
SET rank_tier = CASE
  WHEN total_cc_earned >= 5000 THEN 'master'::rank_tier
  WHEN total_cc_earned >= 2000 THEN 'pro'::rank_tier
  WHEN total_cc_earned >= 750 THEN 'amateur'::rank_tier
  WHEN total_cc_earned >= 200 THEN 'house'::rank_tier
  ELSE 'junior'::rank_tier
END;

-- Step 7: Create or update tier benefits table
CREATE TABLE IF NOT EXISTS tier_benefits (
  tier rank_tier PRIMARY KEY,
  tier_name VARCHAR(50) NOT NULL,
  cc_required_min INTEGER NOT NULL,
  cc_required_max INTEGER,
  booking_discount INTEGER DEFAULT 0,
  early_booking_days INTEGER DEFAULT 0,
  monthly_cc_bonus INTEGER DEFAULT 0,
  perks JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 8: Insert tier benefits
INSERT INTO tier_benefits (tier, tier_name, cc_required_min, cc_required_max, booking_discount, early_booking_days, monthly_cc_bonus, perks) VALUES
  ('junior', 'Junior', 0, 199, 0, 0, 0, '{"welcome_bonus": true, "description": "New members learning the ropes"}'),
  ('house', 'House', 200, 749, 5, 1, 10, '{"weekend_early_access": true, "description": "Regular members with booking perks"}'),
  ('amateur', 'Amateur', 750, 1999, 10, 2, 25, '{"tournaments": true, "description": "Active members with priority access"}'),
  ('pro', 'Pro', 2000, 4999, 15, 3, 50, '{"vip_events": true, "priority_matching": true, "description": "Dedicated members with VIP benefits"}'),
  ('master', 'Master', 5000, NULL, 20, 4, 100, '{"lounge_access": true, "guest_passes": 4, "personal_assistant": true, "description": "Elite members with exclusive privileges"}')
ON CONFLICT (tier) DO UPDATE SET
  tier_name = EXCLUDED.tier_name,
  cc_required_min = EXCLUDED.cc_required_min,
  cc_required_max = EXCLUDED.cc_required_max,
  booking_discount = EXCLUDED.booking_discount,
  early_booking_days = EXCLUDED.early_booking_days,
  monthly_cc_bonus = EXCLUDED.monthly_cc_bonus,
  perks = EXCLUDED.perks,
  updated_at = CURRENT_TIMESTAMP;

-- Step 9: Create function to calculate tier
CREATE OR REPLACE FUNCTION calculate_user_tier(earned_cc INTEGER)
RETURNS rank_tier AS $$
BEGIN
  IF earned_cc >= 5000 THEN
    RETURN 'master'::rank_tier;
  ELSIF earned_cc >= 2000 THEN
    RETURN 'pro'::rank_tier;
  ELSIF earned_cc >= 750 THEN
    RETURN 'amateur'::rank_tier;
  ELSIF earned_cc >= 200 THEN
    RETURN 'house'::rank_tier;
  ELSE
    RETURN 'junior'::rank_tier;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Update rank tracking trigger to use new tiers
CREATE OR REPLACE FUNCTION track_rank_change()
RETURNS TRIGGER AS $$
DECLARE
  current_user_rank INTEGER;
  new_tier rank_tier;
  old_tier rank_tier;
BEGIN
  -- Get the current rank based on total_cc_earned
  SELECT COUNT(*) + 1 INTO current_user_rank
  FROM customer_profiles
  WHERE total_cc_earned > NEW.total_cc_earned;

  -- Calculate new tier
  new_tier := calculate_user_tier(NEW.total_cc_earned);
  old_tier := OLD.rank_tier;

  -- Update tier if changed
  IF new_tier IS DISTINCT FROM old_tier THEN
    NEW.rank_tier := new_tier;
    
    -- Log tier change to rank_history
    INSERT INTO rank_history (user_id, old_rank, new_rank, reason)
    VALUES (NEW.user_id, current_user_rank, current_user_rank, 
            'tier_change_' || old_tier::text || '_to_' || new_tier::text);
  END IF;

  -- Update rank tracking
  IF current_user_rank IS DISTINCT FROM OLD.previous_rank OR OLD.previous_rank IS NULL THEN
    NEW.previous_rank := current_user_rank;
    NEW.rank_last_updated := CURRENT_TIMESTAMP;
    
    -- Log rank change
    IF OLD.previous_rank IS NOT NULL THEN
      INSERT INTO rank_history (user_id, old_rank, new_rank, reason)
      VALUES (NEW.user_id, OLD.previous_rank, current_user_rank, 'cc_balance_change');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Add tier progression tracking
CREATE TABLE IF NOT EXISTS tier_progression (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_tier rank_tier,
  to_tier rank_tier NOT NULL,
  cc_at_change INTEGER NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tier_progression_user_id_changed_at_key UNIQUE (user_id, changed_at)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_tier_progression_user_id ON tier_progression(user_id);
CREATE INDEX IF NOT EXISTS idx_tier_progression_changed_at ON tier_progression(changed_at DESC);

-- Log initial tiers for all users
INSERT INTO tier_progression (user_id, from_tier, to_tier, cc_at_change)
SELECT 
  user_id,
  NULL,
  rank_tier,
  total_cc_earned
FROM customer_profiles
WHERE rank_tier IS NOT NULL;

-- DOWN
-- Revert to old 4-tier system

-- Drop new tables
DROP TABLE IF EXISTS tier_progression;
DROP TABLE IF EXISTS tier_benefits;

-- Drop new function
DROP FUNCTION IF EXISTS calculate_user_tier(INTEGER);

-- Revert enum type
CREATE TYPE rank_tier_old AS ENUM ('house', 'putter', 'iron', 'driver');

ALTER TABLE customer_profiles 
ADD COLUMN rank_tier_old rank_tier_old;

UPDATE customer_profiles
SET rank_tier_old = CASE
  WHEN rank_tier IN ('junior', 'house') THEN 'house'::rank_tier_old
  WHEN rank_tier = 'amateur' THEN 'putter'::rank_tier_old
  WHEN rank_tier = 'pro' THEN 'iron'::rank_tier_old
  WHEN rank_tier = 'master' THEN 'driver'::rank_tier_old
  ELSE 'house'::rank_tier_old
END;

ALTER TABLE customer_profiles DROP COLUMN rank_tier;
ALTER TABLE customer_profiles RENAME COLUMN rank_tier_old TO rank_tier;

DROP TYPE IF EXISTS rank_tier CASCADE;
ALTER TYPE rank_tier_old RENAME TO rank_tier;

-- Restore original trigger function
CREATE OR REPLACE FUNCTION track_rank_change()
RETURNS TRIGGER AS $$
DECLARE
  current_user_rank INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO current_user_rank
  FROM customer_profiles
  WHERE total_cc_earned > NEW.total_cc_earned;

  IF current_user_rank IS DISTINCT FROM OLD.previous_rank OR OLD.previous_rank IS NULL THEN
    NEW.previous_rank := current_user_rank;
    NEW.rank_last_updated := CURRENT_TIMESTAMP;
    
    INSERT INTO rank_history (user_id, old_rank, new_rank, reason)
    VALUES (NEW.user_id, OLD.previous_rank, current_user_rank, 'cc_balance_change');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;