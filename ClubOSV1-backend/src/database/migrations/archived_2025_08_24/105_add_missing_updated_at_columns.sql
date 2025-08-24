-- UP
-- Add missing updated_at column to challenges table
DO $$
BEGIN
  -- Add updated_at column to challenges table if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'challenges' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE challenges ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    
    -- Create trigger to auto-update the timestamp
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $trigger$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $trigger$ LANGUAGE plpgsql;
    
    -- Create trigger if it doesn't exist
    DROP TRIGGER IF EXISTS update_challenges_updated_at ON challenges;
    CREATE TRIGGER update_challenges_updated_at
      BEFORE UPDATE ON challenges
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- DOWN
-- Remove updated_at column and trigger
DO $$
BEGIN
  DROP TRIGGER IF EXISTS update_challenges_updated_at ON challenges;
  
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'challenges' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE challenges DROP COLUMN updated_at;
  END IF;
END $$;