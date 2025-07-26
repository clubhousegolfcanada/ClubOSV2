-- Add last_login column to Users table if it doesn't exist
ALTER TABLE "Users" 
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Users' 
AND column_name = 'last_login';