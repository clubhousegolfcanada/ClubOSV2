-- Check all users with name like Alanna
SELECT 
  u.id,
  u.name,
  u.email,
  u.role,
  u.created_at,
  cp.user_id as has_profile,
  cp.cc_balance,
  cp.total_cc_earned
FROM users u
LEFT JOIN customer_profiles cp ON cp.user_id = u.id
WHERE LOWER(u.name) LIKE '%alanna%' 
   OR LOWER(u.email) LIKE '%alanna%'
ORDER BY u.created_at DESC;

-- Check if there's a customer_profiles entry for Alanna
SELECT 
  u.id,
  u.name,
  u.email,
  cp.user_id IS NOT NULL as has_customer_profile
FROM users u
LEFT JOIN customer_profiles cp ON cp.user_id = u.id
WHERE u.email = 'alanna.belair@gmail.com';

-- If Alanna doesn't have a customer_profiles entry, we need to create one
-- First, get her user ID
SELECT id, name, email FROM users WHERE email = 'alanna.belair@gmail.com';

-- Create customer_profiles entry if missing (uncomment and run if needed)
-- INSERT INTO customer_profiles (
--   user_id, 
--   cc_balance, 
--   total_cc_earned, 
--   total_cc_spent,
--   profile_visibility,
--   created_at,
--   updated_at
-- )
-- SELECT 
--   id as user_id,
--   0 as cc_balance,
--   0 as total_cc_earned,
--   0 as total_cc_spent,
--   'public' as profile_visibility,
--   NOW() as created_at,
--   NOW() as updated_at
-- FROM users 
-- WHERE email = 'alanna.belair@gmail.com'
-- AND NOT EXISTS (
--   SELECT 1 FROM customer_profiles WHERE user_id = users.id
-- );

-- Check what email Alanna should have
SELECT * FROM users WHERE LOWER(name) LIKE '%alanna%';

-- Update Alanna's email if needed (uncomment and modify)
-- UPDATE users 
-- SET email = 'correct.email@domain.com'
-- WHERE name = 'Alanna Belair' 
-- AND email = 'alanna.belair@gmail.com';