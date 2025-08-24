-- UP
-- Add Legend as the 6th tier (10,000+ CC)

-- Step 1: Add 'legend' to the rank_tier enum
-- PostgreSQL doesn't allow direct modification of enums, so we need to be careful
DO $$
BEGIN
  -- Check if 'legend' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'legend' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'rank_tier')
  ) THEN
    -- Add 'legend' value to the enum after 'master'
    ALTER TYPE rank_tier ADD VALUE IF NOT EXISTS 'legend' AFTER 'master';
  END IF;
END $$;

-- Step 2: Insert or update tier benefits for legend
INSERT INTO tier_benefits (
  tier, 
  tier_name, 
  cc_required_min, 
  cc_required_max, 
  booking_discount, 
  early_booking_days, 
  monthly_cc_bonus, 
  perks,
  created_at,
  updated_at
) VALUES (
  'legend', 
  'Legend', 
  10000, 
  NULL,  -- No upper limit for legend
  25,    -- 25% booking discount
  5,     -- 5 days early booking
  200,   -- 200 CC monthly bonus
  jsonb_build_object(
    'legendary_status', true,
    'vip_everything', true,
    'personal_concierge', true,
    'guest_passes', 8,
    'exclusive_events', true,
    'lifetime_recognition', true,
    'description', 'Legendary members with ultimate privileges'
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (tier) DO UPDATE SET
  tier_name = EXCLUDED.tier_name,
  cc_required_min = EXCLUDED.cc_required_min,
  cc_required_max = EXCLUDED.cc_required_max,
  booking_discount = EXCLUDED.booking_discount,
  early_booking_days = EXCLUDED.early_booking_days,
  monthly_cc_bonus = EXCLUDED.monthly_cc_bonus,
  perks = EXCLUDED.perks,
  updated_at = CURRENT_TIMESTAMP;

-- Step 3: Update the calculate_user_tier function to include legend
CREATE OR REPLACE FUNCTION calculate_user_tier(earned_cc INTEGER)
RETURNS rank_tier AS $$
BEGIN
  IF earned_cc >= 10000 THEN
    RETURN 'legend'::rank_tier;
  ELSIF earned_cc >= 5000 THEN
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

-- Step 4: Update any existing users who should be legend tier (10,000+ CC)
UPDATE customer_profiles
SET rank_tier = 'legend'::rank_tier
WHERE total_cc_earned >= 10000
  AND rank_tier != 'legend';

-- Step 5: Log tier changes for users who just became legend
INSERT INTO tier_progression (user_id, from_tier, to_tier, cc_at_change)
SELECT 
  user_id,
  rank_tier as from_tier,
  'legend'::rank_tier as to_tier,
  total_cc_earned as cc_at_change
FROM customer_profiles
WHERE total_cc_earned >= 10000
  AND rank_tier != 'legend'
ON CONFLICT (user_id, changed_at) DO NOTHING;

-- Step 6: Update master tier max CC to 9999
UPDATE tier_benefits
SET cc_required_max = 9999,
    updated_at = CURRENT_TIMESTAMP
WHERE tier = 'master';

-- DOWN
-- Remove legend tier and revert to 5-tier system

-- Step 1: Update users who are legend back to master
UPDATE customer_profiles
SET rank_tier = 'master'::rank_tier
WHERE rank_tier = 'legend';

-- Step 2: Remove legend from tier_benefits
DELETE FROM tier_benefits WHERE tier = 'legend';

-- Step 3: Reset master tier max CC back to NULL
UPDATE tier_benefits
SET cc_required_max = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE tier = 'master';

-- Step 4: Revert the calculate_user_tier function
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

-- Note: We cannot remove 'legend' from the enum type once added
-- This is a PostgreSQL limitation - enum values cannot be dropped