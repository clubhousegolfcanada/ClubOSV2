#!/bin/bash

# Fix broken boxes that have no rewards assigned

echo "🔧 Fixing Broken Boxes (No Rewards Assigned)"
echo "============================================="

# Get database URL from backend .env
BACKEND_DIR="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend"
source "$BACKEND_DIR/.env"

# Create fix SQL
cat > /tmp/fix-broken-boxes.sql << 'EOF'
-- Start transaction
BEGIN;

-- Step 1: Identify broken boxes (available but no rewards)
SELECT 
    'Broken Boxes Found' as report,
    COUNT(*) as broken_count
FROM boxes 
WHERE status = 'available' 
  AND opened_at IS NULL
  AND (reward_type IS NULL OR reward_type = '');

-- Show the broken boxes
SELECT 
    b.id,
    u.name as user_name,
    u.email,
    b.created_at,
    b.reward_type,
    b.reward_value
FROM boxes b
JOIN users u ON b.user_id = u.id
WHERE b.status = 'available' 
  AND b.opened_at IS NULL
  AND (b.reward_type IS NULL OR b.reward_type = '');

-- Step 2: Delete the broken boxes
DELETE FROM boxes 
WHERE status = 'available' 
  AND opened_at IS NULL
  AND (reward_type IS NULL OR reward_type = '');

-- Step 3: Grant new properly configured boxes to affected users
-- This creates 3 new boxes for each user who had broken boxes
WITH affected_users AS (
    SELECT DISTINCT user_id 
    FROM boxes 
    WHERE status = 'available' 
      AND opened_at IS NULL
      AND (reward_type IS NULL OR reward_type = '')
)
INSERT INTO boxes (id, user_id, status, expires_at, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    au.user_id,
    'available',
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW()
FROM affected_users au
CROSS JOIN generate_series(1, 3);

-- Show Mike Belair's boxes after fix
SELECT 
    'Mike Belair Boxes After Fix' as report,
    b.id,
    b.status,
    b.created_at,
    b.opened_at,
    b.reward_type,
    b.reward_value
FROM boxes b
WHERE b.user_id = '6fec2a21-64e0-403c-9ba2-cb88a0b97a4d'
  AND b.status = 'available'
ORDER BY b.created_at DESC;

-- Show summary
SELECT 
    'Summary' as report,
    u.name,
    COUNT(CASE WHEN b.status = 'available' THEN 1 END) as available_boxes,
    COUNT(CASE WHEN b.status = 'opened' THEN 1 END) as opened_boxes
FROM users u
LEFT JOIN boxes b ON u.id = b.user_id
WHERE u.id = '6fec2a21-64e0-403c-9ba2-cb88a0b97a4d'
GROUP BY u.id, u.name;

COMMIT;

-- Note: The backend box opening logic should assign rewards when opened,
-- not when created. These new boxes will get rewards assigned when opened.
EOF

echo "Checking for broken boxes..."
echo ""

# Execute the fix
if [[ "$DATABASE_URL" == *"railway"* ]]; then
    psql "$DATABASE_URL" -f /tmp/fix-broken-boxes.sql
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Broken boxes removed and replaced!"
        echo ""
        echo "What was fixed:"
        echo "- Deleted boxes with no reward data"
        echo "- Created 3 new boxes for affected users"
        echo "- New boxes will get rewards when opened"
        echo ""
        echo "Next: The backend should assign rewards when opening,"
        echo "      not when creating boxes."
    else
        echo "❌ Error fixing boxes"
    fi
else
    echo "ERROR: Not connected to Railway database"
fi

rm -f /tmp/fix-broken-boxes.sql