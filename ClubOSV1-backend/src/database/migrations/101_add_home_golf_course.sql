-- UP
-- Add home_golf_course column to customer_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customer_profiles' 
    AND column_name = 'home_golf_course'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN home_golf_course VARCHAR(200);
  END IF;
END $$;

-- Add index for faster lookups by home golf course
CREATE INDEX IF NOT EXISTS idx_customer_profiles_home_golf_course 
ON customer_profiles(home_golf_course);

-- DOWN
ALTER TABLE customer_profiles DROP COLUMN IF EXISTS home_golf_course;
DROP INDEX IF EXISTS idx_customer_profiles_home_golf_course;