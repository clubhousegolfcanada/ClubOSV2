-- Migration: Grant 100 CC founding member bonus to existing customers
-- This ensures all customers created before the ClubCoin system have their initial grant

-- UP

-- First, ensure all customer users have a profile
INSERT INTO customer_profiles (user_id, cc_balance, current_rank)
SELECT 
  u.id,
  0,
  'house'
FROM "Users" u
WHERE u.role = 'customer'
  AND u.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM customer_profiles cp WHERE cp.user_id = u.id
  );

-- Create a temporary function to grant CC to users without initial grant
CREATE OR REPLACE FUNCTION grant_founding_member_bonus()
RETURNS TABLE (
  user_id UUID,
  user_name VARCHAR,
  cc_granted DECIMAL
) AS $$
DECLARE
  v_user RECORD;
  v_season_id UUID;
BEGIN
  -- Get current active season if exists
  SELECT id INTO v_season_id FROM seasons WHERE status = 'active' LIMIT 1;
  
  -- Process each customer without initial grant
  FOR v_user IN 
    SELECT 
      u.id,
      u.name,
      u.email,
      COALESCE(cp.cc_balance, 0) as current_balance
    FROM "Users" u
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    WHERE u.role = 'customer'
      AND u.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM cc_transactions ct
        WHERE ct.user_id = u.id 
        AND ct.type = 'initial_grant'
      )
  LOOP
    -- Update customer profile balance
    UPDATE customer_profiles
    SET 
      cc_balance = COALESCE(cc_balance, 0) + 100,
      total_cc_earned = COALESCE(total_cc_earned, 0) + 100
    WHERE user_id = v_user.id;
    
    -- Log the transaction
    INSERT INTO cc_transactions (
      user_id,
      type,
      amount,
      balance_before,
      balance_after,
      description,
      season_id,
      created_at
    ) VALUES (
      v_user.id,
      'initial_grant',
      100,
      v_user.current_balance,
      v_user.current_balance + 100,
      'Founding Member Bonus - Welcome to Clubhouse Challenges!',
      v_season_id,
      CURRENT_TIMESTAMP
    );
    
    -- Add/update seasonal earnings if season exists
    IF v_season_id IS NOT NULL THEN
      INSERT INTO seasonal_cc_earnings (
        user_id,
        season_id,
        cc_from_bonuses,
        cc_net,
        challenges_completed,
        last_updated
      ) VALUES (
        v_user.id,
        v_season_id,
        100,
        100,
        0,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id, season_id) 
      DO UPDATE SET 
        cc_from_bonuses = seasonal_cc_earnings.cc_from_bonuses + 100,
        cc_net = seasonal_cc_earnings.cc_net + 100,
        last_updated = CURRENT_TIMESTAMP;
    END IF;
    
    -- Return result
    user_id := v_user.id;
    user_name := v_user.name;
    cc_granted := 100;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the grant function and store results
CREATE TEMP TABLE migration_results AS
SELECT * FROM grant_founding_member_bonus();

-- Log migration summary
DO $$
DECLARE
  v_count INTEGER;
  v_total_granted DECIMAL;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(cc_granted), 0) 
  INTO v_count, v_total_granted
  FROM migration_results;
  
  IF v_count > 0 THEN
    RAISE NOTICE 'Granted founding member bonus to % customers (% CC total)', v_count, v_total_granted;
  ELSE
    RAISE NOTICE 'All customers already have their founding member bonus';
  END IF;
END $$;

-- Clean up
DROP FUNCTION IF EXISTS grant_founding_member_bonus();

-- Verify all customers now have initial grant
DO $$
DECLARE
  v_missing INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_missing
  FROM "Users" u
  WHERE u.role = 'customer'
    AND u.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM cc_transactions ct
      WHERE ct.user_id = u.id 
      AND ct.type = 'initial_grant'
    );
  
  IF v_missing > 0 THEN
    RAISE WARNING 'Still % customers without initial grant - check logs', v_missing;
  END IF;
END $$;

-- DOWN

-- We don't reverse granted CC as it would be disruptive to users
-- But we mark this migration as reversible for tracking
-- If needed, could identify and remove specific transactions created by this migration