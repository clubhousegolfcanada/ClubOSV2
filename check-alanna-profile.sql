-- Check Alanna's profile data
SELECT 
  u.id,
  u.name,
  u.email,
  cp.cc_balance,
  cp.total_cc_earned,
  cp.total_cc_spent,
  cp.display_name,
  cp.profile_visibility,
  cp.current_rank
FROM users u
LEFT JOIN customer_profiles cp ON cp.user_id = u.id
WHERE u.email LIKE '%alanna%' OR u.name LIKE '%Alanna%';

-- Check if she's in seasonal earnings
SELECT 
  u.name,
  sce.total_earned,
  sce.challenges_won
FROM users u
LEFT JOIN seasonal_cc_earnings sce ON sce.user_id = u.id
WHERE u.email LIKE '%alanna%' OR u.name LIKE '%Alanna%';

-- Check friend relationship with Mike
SELECT 
  f.status,
  f.requested_at,
  f.accepted_at,
  u1.name as user1,
  u2.name as user2
FROM friendships f
JOIN users u1 ON u1.id = f.user_id
JOIN users u2 ON u2.id = f.friend_id
WHERE (u1.email = 'mikebelair79@gmail.com' OR u2.email = 'mikebelair79@gmail.com')
  AND (u1.name LIKE '%Alanna%' OR u2.name LIKE '%Alanna%');