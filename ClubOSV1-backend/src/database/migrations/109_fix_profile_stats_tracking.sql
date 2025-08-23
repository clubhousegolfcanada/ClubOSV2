-- UP
-- Fix profile stats tracking for challenges

-- Create function to update challenge stats when a challenge is resolved
CREATE OR REPLACE FUNCTION update_challenge_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- When challenge moves to 'resolved' status
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    -- Update both players' total_challenges_played
    UPDATE customer_profiles 
    SET 
      total_challenges_played = total_challenges_played + 1,
      last_challenge_at = CURRENT_TIMESTAMP
    WHERE user_id IN (NEW.creator_id, NEW.acceptor_id);
    
    -- Update winner stats if winner is determined
    IF NEW.winner_user_id IS NOT NULL THEN
      UPDATE customer_profiles 
      SET 
        total_challenges_won = total_challenges_won + 1
      WHERE user_id = NEW.winner_user_id;
    END IF;
    
    -- Recalculate win rates for both players
    UPDATE customer_profiles 
    SET challenge_win_rate = 
      CASE 
        WHEN total_challenges_played > 0 
        THEN total_challenges_won::decimal / total_challenges_played::decimal
        ELSE 0
      END
    WHERE user_id IN (NEW.creator_id, NEW.acceptor_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for challenge stats
DROP TRIGGER IF EXISTS update_challenge_stats_trigger ON challenges;
CREATE TRIGGER update_challenge_stats_trigger
AFTER UPDATE ON challenges
FOR EACH ROW
EXECUTE FUNCTION update_challenge_stats();

-- Create function to track total CC earned
CREATE OR REPLACE FUNCTION update_cc_earned()
RETURNS TRIGGER AS $$
BEGIN
  -- Track earnings from various sources
  IF NEW.transaction_type IN ('challenge_win', 'challenge_stake_return', 'daily_bonus', 'achievement_bonus', 'rank_bonus', 'gift_card_cashback') THEN
    UPDATE customer_profiles 
    SET total_cc_earned = total_cc_earned + NEW.amount
    WHERE user_id = NEW.user_id;
  END IF;
  
  -- Track spending
  IF NEW.transaction_type IN ('challenge_stake', 'gift_card_purchase', 'store_purchase') THEN
    UPDATE customer_profiles 
    SET total_cc_spent = total_cc_spent + ABS(NEW.amount)
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for CC earned tracking
DROP TRIGGER IF EXISTS update_cc_earned_trigger ON cc_transactions;
CREATE TRIGGER update_cc_earned_trigger
AFTER INSERT ON cc_transactions
FOR EACH ROW
EXECUTE FUNCTION update_cc_earned();

-- Fix existing data: Recalculate stats for all users based on historical data
UPDATE customer_profiles cp
SET 
  total_challenges_played = (
    SELECT COUNT(*) 
    FROM challenges c 
    WHERE c.status = 'resolved' 
    AND (c.creator_id = cp.user_id OR c.acceptor_id = cp.user_id)
  ),
  total_challenges_won = (
    SELECT COUNT(*) 
    FROM challenges c 
    WHERE c.status = 'resolved' 
    AND c.winner_user_id = cp.user_id
  ),
  challenge_win_rate = CASE 
    WHEN (
      SELECT COUNT(*) 
      FROM challenges c 
      WHERE c.status = 'resolved' 
      AND (c.creator_id = cp.user_id OR c.acceptor_id = cp.user_id)
    ) > 0 
    THEN (
      SELECT COUNT(*) 
      FROM challenges c 
      WHERE c.status = 'resolved' 
      AND c.winner_user_id = cp.user_id
    )::decimal / (
      SELECT COUNT(*) 
      FROM challenges c 
      WHERE c.status = 'resolved' 
      AND (c.creator_id = cp.user_id OR c.acceptor_id = cp.user_id)
    )::decimal
    ELSE 0
  END,
  last_challenge_at = (
    SELECT MAX(c.resolved_at)
    FROM challenges c 
    WHERE c.status = 'resolved' 
    AND (c.creator_id = cp.user_id OR c.acceptor_id = cp.user_id)
  );

-- Recalculate total_cc_earned from transaction history
UPDATE customer_profiles cp
SET 
  total_cc_earned = COALESCE((
    SELECT SUM(amount) 
    FROM cc_transactions 
    WHERE user_id = cp.user_id 
    AND transaction_type IN ('challenge_win', 'challenge_stake_return', 'daily_bonus', 'achievement_bonus', 'rank_bonus', 'gift_card_cashback')
    AND amount > 0
  ), 0),
  total_cc_spent = COALESCE((
    SELECT SUM(ABS(amount))
    FROM cc_transactions 
    WHERE user_id = cp.user_id 
    AND transaction_type IN ('challenge_stake', 'gift_card_purchase', 'store_purchase')
    AND amount < 0
  ), 0);

-- DOWN
DROP TRIGGER IF EXISTS update_challenge_stats_trigger ON challenges;
DROP FUNCTION IF EXISTS update_challenge_stats();
DROP TRIGGER IF EXISTS update_cc_earned_trigger ON cc_transactions;
DROP FUNCTION IF EXISTS update_cc_earned();