-- UP
-- Add customer role to users table if not exists
DO $$
BEGIN
  -- Check if 'customer' is not in the constraint, then update it
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'valid_role' 
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%customer%'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role;
    ALTER TABLE users ADD CONSTRAINT valid_role CHECK (role IN ('admin', 'operator', 'support', 'kiosk', 'customer'));
  END IF;
END $$;

-- Add location field to users table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'location'
  ) THEN
    ALTER TABLE users ADD COLUMN location VARCHAR(100);
  END IF;
END $$;

-- Add any missing columns to customer_profiles
DO $$
BEGIN
  -- Add city column if not exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customer_profiles' 
    AND column_name = 'city'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN city VARCHAR(100);
  END IF;
  
  -- Add state_province column if not exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customer_profiles' 
    AND column_name = 'state_province'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN state_province VARCHAR(100);
  END IF;
  
  -- Add country column if not exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customer_profiles' 
    AND column_name = 'country'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN country VARCHAR(100) DEFAULT 'Canada';
  END IF;
  
  -- Add postal_code column if not exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customer_profiles' 
    AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN postal_code VARCHAR(20);
  END IF;
  
  -- Add date_of_birth column if not exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customer_profiles' 
    AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN date_of_birth DATE;
  END IF;
  
  -- Add gender column if not exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customer_profiles' 
    AND column_name = 'gender'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN gender VARCHAR(20);
  END IF;
  
  -- Add member_number column if not exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customer_profiles' 
    AND column_name = 'member_number'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN member_number VARCHAR(50);
  END IF;
  
  -- Add membership_type column if not exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customer_profiles' 
    AND column_name = 'membership_type'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN membership_type VARCHAR(50);
  END IF;
  
  -- Add emergency_contact_name column if not exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customer_profiles' 
    AND column_name = 'emergency_contact_name'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN emergency_contact_name VARCHAR(100);
  END IF;
  
  -- Add emergency_contact_phone column if not exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customer_profiles' 
    AND column_name = 'emergency_contact_phone'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN emergency_contact_phone VARCHAR(50);
  END IF;
END $$;

-- DOWN
-- Remove added columns (be careful with this in production)
ALTER TABLE users DROP COLUMN IF EXISTS location;
ALTER TABLE customer_profiles DROP COLUMN IF EXISTS city;
ALTER TABLE customer_profiles DROP COLUMN IF EXISTS state_province;
ALTER TABLE customer_profiles DROP COLUMN IF EXISTS country;
ALTER TABLE customer_profiles DROP COLUMN IF EXISTS postal_code;
ALTER TABLE customer_profiles DROP COLUMN IF EXISTS date_of_birth;
ALTER TABLE customer_profiles DROP COLUMN IF EXISTS gender;
ALTER TABLE customer_profiles DROP COLUMN IF EXISTS member_number;
ALTER TABLE customer_profiles DROP COLUMN IF EXISTS membership_type;
ALTER TABLE customer_profiles DROP COLUMN IF EXISTS emergency_contact_name;
ALTER TABLE customer_profiles DROP COLUMN IF EXISTS emergency_contact_phone;