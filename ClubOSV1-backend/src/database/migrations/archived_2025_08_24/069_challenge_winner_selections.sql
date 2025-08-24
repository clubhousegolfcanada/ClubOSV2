-- Migration: Add challenge_winner_selections table
-- Purpose: Track winner selections by both players to resolve challenges when both agree

-- Create table for tracking winner selections
CREATE TABLE IF NOT EXISTS challenge_winner_selections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_winner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure each user can only select once per challenge
  UNIQUE(challenge_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_winner_selections_challenge ON challenge_winner_selections (challenge_id);
CREATE INDEX IF NOT EXISTS idx_winner_selections_user ON challenge_winner_selections (user_id);
CREATE INDEX IF NOT EXISTS idx_winner_selections_timestamp ON challenge_winner_selections (selected_at DESC);

-- Add comment
COMMENT ON TABLE challenge_winner_selections IS 'Tracks winner selections by both players - challenge resolves when both agree';
COMMENT ON COLUMN challenge_winner_selections.selected_winner_id IS 'The user_id that this player believes won the challenge';

-- Create a function to check if both players have selected and if they agree
CREATE OR REPLACE FUNCTION check_challenge_winner_agreement()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_id UUID;
  v_acceptor_id UUID;
  v_selection_count INTEGER;
  v_creator_selection UUID;
  v_acceptor_selection UUID;
  v_challenge_status VARCHAR(20);
BEGIN
  -- Get challenge details
  SELECT creator_id, acceptor_id, status 
  INTO v_creator_id, v_acceptor_id, v_challenge_status
  FROM challenges 
  WHERE id = NEW.challenge_id;
  
  -- Only process active challenges
  IF v_challenge_status != 'active' AND v_challenge_status != 'accepted' THEN
    RETURN NEW;
  END IF;
  
  -- Count selections for this challenge
  SELECT COUNT(*) INTO v_selection_count
  FROM challenge_winner_selections
  WHERE challenge_id = NEW.challenge_id;
  
  -- If both players have selected
  IF v_selection_count >= 2 THEN
    -- Get both selections
    SELECT selected_winner_id INTO v_creator_selection
    FROM challenge_winner_selections
    WHERE challenge_id = NEW.challenge_id 
    AND user_id = v_creator_id;
    
    SELECT selected_winner_id INTO v_acceptor_selection
    FROM challenge_winner_selections
    WHERE challenge_id = NEW.challenge_id 
    AND user_id = v_acceptor_id;
    
    -- If both exist and agree
    IF v_creator_selection IS NOT NULL 
    AND v_acceptor_selection IS NOT NULL 
    AND v_creator_selection = v_acceptor_selection THEN
      -- Update challenge status to ready for resolution
      UPDATE challenges 
      SET status = 'ready_resolve',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.challenge_id;
      
      -- Log the agreement
      INSERT INTO challenge_audit (
        challenge_id,
        action_type,
        action_by,
        action_data,
        created_at
      ) VALUES (
        NEW.challenge_id,
        'winner_agreed',
        NEW.user_id,
        jsonb_build_object(
          'agreed_winner_id', v_creator_selection,
          'creator_selection', v_creator_selection,
          'acceptor_selection', v_acceptor_selection
        ),
        CURRENT_TIMESTAMP
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to check for agreement after each selection
CREATE TRIGGER check_winner_agreement_trigger
AFTER INSERT ON challenge_winner_selections
FOR EACH ROW
EXECUTE FUNCTION check_challenge_winner_agreement();