-- Check if box exists and its status
SELECT id, user_id, status, opened_at, created_at 
FROM boxes 
WHERE id = '20f9abbb-92dc-4ed7-bd93-6a466e66c9dc';

-- Check all boxes for user Mike Belair
SELECT id, status, opened_at, created_at 
FROM boxes 
WHERE user_id = '6fec2a21-64e0-403c-9ba2-cb88a0b97a4d'
ORDER BY created_at DESC
LIMIT 10;

-- Check if there are any available boxes
SELECT COUNT(*) as available_count 
FROM boxes 
WHERE user_id = '6fec2a21-64e0-403c-9ba2-cb88a0b97a4d' 
AND status = 'available';
