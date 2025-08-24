-- Check Alanna's user data
SELECT 
  u.id,
  u.name,
  u.email,
  u.role,
  cp.display_name,
  cp.cc_balance,
  cp.total_cc_earned,
  cp.profile_visibility
FROM users u
LEFT JOIN customer_profiles cp ON cp.user_id = u.id
WHERE LOWER(u.name) LIKE '%alanna%' OR LOWER(u.email) LIKE '%alanna%';

-- Check Mike's user data
SELECT 
  u.id as mike_id,
  u.name as mike_name,
  u.email as mike_email
FROM users u
WHERE u.email = 'mikebelair79@gmail.com';

-- Check friendship between Mike and Alanna
SELECT 
  f.id as friendship_id,
  f.status,
  f.requested_at,
  f.accepted_at,
  u1.name as user1_name,
  u1.email as user1_email,
  u2.name as user2_name,
  u2.email as user2_email
FROM friendships f
JOIN users u1 ON u1.id = f.user_id
JOIN users u2 ON u2.id = f.friend_id
WHERE 
  (u1.email = 'mikebelair79@gmail.com' AND (LOWER(u2.name) LIKE '%alanna%' OR LOWER(u2.email) LIKE '%alanna%'))
  OR 
  (u2.email = 'mikebelair79@gmail.com' AND (LOWER(u1.name) LIKE '%alanna%' OR LOWER(u1.email) LIKE '%alanna%'));

-- Check if Alanna appears in the friends query for Mike
WITH mike AS (
  SELECT id FROM users WHERE email = 'mikebelair79@gmail.com'
)
SELECT 
  u.name,
  u.email,
  f.status,
  cp.cc_balance,
  cp.total_cc_earned
FROM friendships f
JOIN users u ON (
  CASE 
    WHEN f.user_id = (SELECT id FROM mike) THEN f.friend_id = u.id
    ELSE f.user_id = u.id
  END
)
LEFT JOIN customer_profiles cp ON cp.user_id = u.id
WHERE (f.user_id = (SELECT id FROM mike) OR f.friend_id = (SELECT id FROM mike))
  AND f.status = 'accepted'
  AND (LOWER(u.name) LIKE '%alanna%' OR LOWER(u.email) LIKE '%alanna%');