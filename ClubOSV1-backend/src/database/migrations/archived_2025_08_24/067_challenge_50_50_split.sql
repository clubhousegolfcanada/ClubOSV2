-- Migration: Update challenge stakes to 50/50 split
-- Purpose: Change from 30/70 creator/acceptor split to fair 50/50 split

-- Drop the existing trigger function first
DROP FUNCTION IF EXISTS calculate_challenge_stakes() CASCADE;

-- Create updated trigger function with 50/50 split
CREATE OR REPLACE FUNCTION calculate_challenge_stakes()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate stakes based on 50/50 split
  IF NEW.creator_stake_amount IS NULL THEN
    NEW.creator_stake_amount := ROUND(NEW.wager_amount * 0.50, 2);
  END IF;
  
  IF NEW.acceptor_stake_amount IS NULL THEN
    NEW.acceptor_stake_amount := ROUND(NEW.wager_amount * 0.50, 2);
  END IF;
  
  NEW.total_pot := NEW.creator_stake_amount + NEW.acceptor_stake_amount;
  
  -- Set expiry time
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := CURRENT_TIMESTAMP + (NEW.expiry_days || ' days')::INTERVAL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER calculate_challenge_stakes_trigger
  BEFORE INSERT OR UPDATE ON challenges
  FOR EACH ROW
  EXECUTE FUNCTION calculate_challenge_stakes();

-- Update the create_challenge function to use 50/50 split
CREATE OR REPLACE FUNCTION create_challenge(
  p_creator_id UUID,
  p_acceptor_id UUID,
  p_course_id UUID,
  p_wager_amount DECIMAL,
  p_expiry_days INTEGER DEFAULT 7,
  p_creator_note TEXT DEFAULT NULL,
  p_trackman_settings JSONB DEFAULT '{}',
  p_creator_percentage DECIMAL DEFAULT 0.50,  -- Changed from 0.30
  p_acceptor_percentage DECIMAL DEFAULT 0.50  -- Changed from 0.70
) RETURNS UUID AS $$
DECLARE
  v_challenge_id UUID;
  v_creator_stake DECIMAL;
  v_acceptor_stake DECIMAL;
BEGIN
  -- Calculate stakes
  v_creator_stake := ROUND(p_wager_amount * p_creator_percentage, 2);
  v_acceptor_stake := ROUND(p_wager_amount * p_acceptor_percentage, 2);
  
  -- Create challenge
  INSERT INTO challenges (
    creator_id,
    acceptor_id,
    course_id,
    wager_amount,
    creator_stake_amount,
    acceptor_stake_amount,
    expiry_days,
    creator_note,
    trackman_settings,
    status
  ) VALUES (
    p_creator_id,
    p_acceptor_id,
    p_course_id,
    p_wager_amount,
    v_creator_stake,
    v_acceptor_stake,
    p_expiry_days,
    p_creator_note,
    p_trackman_settings,
    'pending'
  ) RETURNING id INTO v_challenge_id;
  
  -- Create stake records with 50/50 split
  INSERT INTO stakes (challenge_id, user_id, role, amount, percentage)
  VALUES 
    (v_challenge_id, p_creator_id, 'creator', v_creator_stake, 0.50),
    (v_challenge_id, p_acceptor_id, 'acceptor', v_acceptor_stake, 0.50);
  
  -- Log audit
  INSERT INTO challenge_audit (challenge_id, event_type, user_id, old_status, new_status)
  VALUES (v_challenge_id, 'created', p_creator_id, NULL, 'pending');
  
  RETURN v_challenge_id;
END;
$$ LANGUAGE plpgsql;

-- Update existing pending challenges to use 50/50 split (optional)
-- Only update challenges that haven't been accepted yet
UPDATE challenges
SET 
  creator_stake_amount = ROUND(wager_amount * 0.50, 2),
  acceptor_stake_amount = ROUND(wager_amount * 0.50, 2),
  total_pot = wager_amount
WHERE status IN ('pending', 'draft')
  AND created_at >= CURRENT_DATE - INTERVAL '7 days';  -- Only recent challenges

-- Update stakes table for pending challenges
UPDATE stakes s
SET 
  amount = CASE 
    WHEN s.role = 'creator' THEN ROUND(c.wager_amount * 0.50, 2)
    WHEN s.role = 'acceptor' THEN ROUND(c.wager_amount * 0.50, 2)
  END,
  percentage = 0.50
FROM challenges c
WHERE s.challenge_id = c.id
  AND c.status IN ('pending', 'draft')
  AND s.is_locked = false;

-- Add comment to document the change
COMMENT ON FUNCTION calculate_challenge_stakes() IS 'Calculates 50/50 stake split for challenges. Updated from 30/70 to provide fair split between creator and acceptor.';