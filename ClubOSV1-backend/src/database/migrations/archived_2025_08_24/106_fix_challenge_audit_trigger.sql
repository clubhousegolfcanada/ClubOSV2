-- UP
-- Fix the check_challenge_winner_agreement trigger to use correct column names
CREATE OR REPLACE FUNCTION check_challenge_winner_agreement() 
RETURNS TRIGGER AS $$
DECLARE
  v_creator_id UUID;
  v_acceptor_id UUID;
  v_creator_selection UUID;
  v_acceptor_selection UUID;
  v_both_selected BOOLEAN;
BEGIN
  -- Get the challenge details
  SELECT creator_id, acceptor_id 
  INTO v_creator_id, v_acceptor_id
  FROM challenges 
  WHERE id = NEW.challenge_id;
  
  -- Get both players' selections
  SELECT 
    MAX(CASE WHEN user_id = v_creator_id THEN winner_id END),
    MAX(CASE WHEN user_id = v_acceptor_id THEN winner_id END)
  INTO v_creator_selection, v_acceptor_selection
  FROM challenge_winner_selections
  WHERE challenge_id = NEW.challenge_id
    AND user_id IN (v_creator_id, v_acceptor_id);
  
  -- Check if both have selected
  v_both_selected := v_creator_selection IS NOT NULL AND v_acceptor_selection IS NOT NULL;
  
  IF v_both_selected THEN
    -- If they agree on the winner
    IF v_creator_selection = v_acceptor_selection THEN
      -- Update challenge status to ready to resolve
      UPDATE challenges 
      SET status = 'ready_resolve',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.challenge_id;
      
      -- Log the agreement (using correct column names)
      INSERT INTO challenge_audit (
        challenge_id,
        event_type,  -- Changed from action_type
        user_id,      -- Changed from action_by
        event_data,   -- Changed from action_data
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

-- DOWN
-- Revert to the original (broken) version
CREATE OR REPLACE FUNCTION check_challenge_winner_agreement() 
RETURNS TRIGGER AS $$
DECLARE
  v_creator_id UUID;
  v_acceptor_id UUID;
  v_creator_selection UUID;
  v_acceptor_selection UUID;
  v_both_selected BOOLEAN;
BEGIN
  -- Get the challenge details
  SELECT creator_id, acceptor_id 
  INTO v_creator_id, v_acceptor_id
  FROM challenges 
  WHERE id = NEW.challenge_id;
  
  -- Get both players' selections
  SELECT 
    MAX(CASE WHEN user_id = v_creator_id THEN winner_id END),
    MAX(CASE WHEN user_id = v_acceptor_id THEN winner_id END)
  INTO v_creator_selection, v_acceptor_selection
  FROM challenge_winner_selections
  WHERE challenge_id = NEW.challenge_id
    AND user_id IN (v_creator_id, v_acceptor_id);
  
  -- Check if both have selected
  v_both_selected := v_creator_selection IS NOT NULL AND v_acceptor_selection IS NOT NULL;
  
  IF v_both_selected THEN
    -- If they agree on the winner
    IF v_creator_selection = v_acceptor_selection THEN
      -- Update challenge status to ready to resolve
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