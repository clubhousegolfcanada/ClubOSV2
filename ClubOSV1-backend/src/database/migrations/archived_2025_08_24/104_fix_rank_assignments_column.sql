-- UP
-- Fix rank_assignments table column name
-- The column was created as 'rank' but the code expects 'rank_tier'
DO $$
BEGIN
  -- Check if the table exists and has the 'rank' column
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'rank_assignments' 
    AND column_name = 'rank'
    AND NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'rank_assignments' 
      AND column_name = 'rank_tier'
    )
  ) THEN
    -- Rename the column from 'rank' to 'rank_tier'
    ALTER TABLE rank_assignments RENAME COLUMN rank TO rank_tier;
  END IF;
  
  -- Also add any missing columns that might have been missed
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'rank_assignments' 
    AND column_name = 'calculated_at'
  ) THEN
    ALTER TABLE rank_assignments ADD COLUMN calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- DOWN
-- Revert the column name back to 'rank'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'rank_assignments' 
    AND column_name = 'rank_tier'
  ) THEN
    ALTER TABLE rank_assignments RENAME COLUMN rank_tier TO rank;
  END IF;
  
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'rank_assignments' 
    AND column_name = 'calculated_at'
  ) THEN
    ALTER TABLE rank_assignments DROP COLUMN calculated_at;
  END IF;
END $$;