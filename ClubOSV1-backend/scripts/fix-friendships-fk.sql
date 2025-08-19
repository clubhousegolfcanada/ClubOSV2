-- Fix friendships foreign key constraints to reference uppercase Users table
-- This script migrates data and fixes the foreign key references

BEGIN;

-- First check the role constraint on lowercase users table
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role;

-- Add customer role to the constraint
ALTER TABLE users ADD CONSTRAINT valid_role 
CHECK (role::text = ANY (ARRAY['admin', 'operator', 'support', 'kiosk', 'customer']::text[]));

-- Update existing duplicate records first (prefer the uppercase Users table data)
UPDATE users u
SET 
  password = u2.password,
  name = u2.name,
  phone = u2.phone,
  role = CASE 
    WHEN u2.role::text = 'customer' THEN 'customer'
    WHEN u2.role::text = 'admin' THEN 'admin'
    WHEN u2.role::text = 'operator' THEN 'operator'
    WHEN u2.role::text = 'kiosk' THEN 'kiosk'
    ELSE 'support'
  END,
  updated_at = u2."updatedAt",
  last_login = u2.last_login,
  is_active = u2."isActive"
FROM "Users" u2
WHERE u.email = u2.email;

-- Insert only non-duplicate users from uppercase Users table to lowercase users table
INSERT INTO users (id, email, password, name, phone, role, created_at, updated_at, last_login, is_active)
SELECT 
  id, 
  email, 
  password, 
  name, 
  phone, 
  CASE 
    WHEN role::text = 'customer' THEN 'customer'
    WHEN role::text = 'admin' THEN 'admin'
    WHEN role::text = 'operator' THEN 'operator'
    WHEN role::text = 'kiosk' THEN 'kiosk'
    ELSE 'support'
  END as role,
  "createdAt" as created_at,
  "updatedAt" as updated_at,
  last_login,
  "isActive" as is_active
FROM "Users" u1
WHERE NOT EXISTS (
  SELECT 1 FROM users u2 WHERE u2.email = u1.email
)
ON CONFLICT (id) DO NOTHING;

-- Verify the sync worked
SELECT 
  (SELECT COUNT(*) FROM "Users") as users_uppercase_count,
  (SELECT COUNT(*) FROM users) as users_lowercase_count,
  (SELECT COUNT(*) FROM users WHERE role = 'customer') as customer_count;

COMMIT;