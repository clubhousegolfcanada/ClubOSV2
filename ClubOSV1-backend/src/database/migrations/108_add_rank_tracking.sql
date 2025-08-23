-- UP
-- Add columns to track rank changes in customer_profiles
ALTER TABLE customer_profiles
ADD COLUMN IF NOT EXISTS previous_rank INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rank_last_updated TIMESTAMP DEFAULT NULL;

-- Create a table to track historical rank changes
CREATE TABLE IF NOT EXISTS rank_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_rank INTEGER,
  new_rank INTEGER,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(100) -- e.g., 'challenge_win', 'challenge_loss', 'season_reset'
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_rank_history_user_id ON rank_history(user_id);
CREATE INDEX IF NOT EXISTS idx_rank_history_changed_at ON rank_history(changed_at DESC);

-- Function to track rank changes
CREATE OR REPLACE FUNCTION track_rank_change()
RETURNS TRIGGER AS $$
DECLARE
  current_user_rank INTEGER;
  other_users RECORD;
BEGIN
  -- Get the current rank based on total_cc_earned
  SELECT COUNT(*) + 1 INTO current_user_rank
  FROM customer_profiles
  WHERE total_cc_earned > NEW.total_cc_earned;

  -- If rank has changed, update previous_rank and log to history
  IF current_user_rank IS DISTINCT FROM OLD.previous_rank OR OLD.previous_rank IS NULL THEN
    -- Update the user's previous rank
    NEW.previous_rank := current_user_rank;
    NEW.rank_last_updated := CURRENT_TIMESTAMP;
    
    -- Log the rank change
    INSERT INTO rank_history (user_id, old_rank, new_rank, reason)
    VALUES (NEW.user_id, OLD.previous_rank, current_user_rank, 'cc_balance_change');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to track rank changes when CC balance changes
DROP TRIGGER IF EXISTS track_rank_changes_trigger ON customer_profiles;
CREATE TRIGGER track_rank_changes_trigger
BEFORE UPDATE OF total_cc_earned, cc_balance ON customer_profiles
FOR EACH ROW
EXECUTE FUNCTION track_rank_change();

-- Initialize previous_rank for existing users based on their current standing
UPDATE customer_profiles cp
SET previous_rank = (
  SELECT COUNT(*) + 1
  FROM customer_profiles cp2
  WHERE cp2.total_cc_earned > cp.total_cc_earned
),
rank_last_updated = CURRENT_TIMESTAMP
WHERE previous_rank IS NULL;

-- DOWN
DROP TRIGGER IF EXISTS track_rank_changes_trigger ON customer_profiles;
DROP FUNCTION IF EXISTS track_rank_change();
DROP TABLE IF EXISTS rank_history;
ALTER TABLE customer_profiles 
DROP COLUMN IF EXISTS previous_rank,
DROP COLUMN IF EXISTS rank_last_updated;