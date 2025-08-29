#!/bin/bash

# Fix all users' box issues comprehensively

echo "🔧 Fixing Box System for All Users"
echo "==================================="

# Get database URL from backend .env
BACKEND_DIR="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend"
source "$BACKEND_DIR/.env"

# Create comprehensive fix SQL
cat > /tmp/fix-boxes.sql << 'EOF'
-- Start transaction
BEGIN;

-- Step 1: Show current box statistics
SELECT 
    'Current Box Statistics' as report,
    COUNT(*) as total_boxes,
    COUNT(DISTINCT user_id) as unique_users,
    SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_boxes,
    SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END) as opened_boxes,
    SUM(CASE WHEN status = 'available' AND opened_at IS NOT NULL THEN 1 ELSE 0 END) as broken_available,
    SUM(CASE WHEN status = 'opened' AND opened_at IS NULL THEN 1 ELSE 0 END) as broken_opened
FROM boxes;

-- Step 2: Fix inconsistent box states
-- Mark boxes with opened_at as 'opened' regardless of current status
UPDATE boxes 
SET status = 'opened',
    updated_at = NOW()
WHERE opened_at IS NOT NULL 
  AND status != 'opened';

-- Step 3: Clean up old unopened boxes (older than 30 days)
DELETE FROM boxes 
WHERE status = 'available' 
  AND opened_at IS NULL
  AND created_at < NOW() - INTERVAL '30 days';

-- Step 4: Remove duplicate available boxes for users
-- Keep only the 3 most recent available boxes per user
WITH ranked_boxes AS (
    SELECT id,
           user_id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM boxes
    WHERE status = 'available' 
      AND opened_at IS NULL
)
DELETE FROM boxes 
WHERE id IN (
    SELECT id FROM ranked_boxes WHERE rn > 3
);

-- Step 5: Grant fresh boxes to active users who have none
-- Give 3 boxes to users who have opened all their boxes
INSERT INTO boxes (id, user_id, status, expires_at, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    u.id,
    'available',
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW()
FROM users u
WHERE u.role = 'customer'
  AND NOT EXISTS (
    SELECT 1 FROM boxes b 
    WHERE b.user_id = u.id 
      AND b.status = 'available' 
      AND b.opened_at IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM boxes b2 
    WHERE b2.user_id = u.id
  )
-- Generate 3 boxes per user
CROSS JOIN generate_series(1, 3);

-- Step 6: Reset box progress for users
UPDATE box_progress
SET current_progress = 0,
    updated_at = NOW()
WHERE current_progress >= required_progress;

-- Step 7: Show results
SELECT 
    'After Fixes' as report,
    COUNT(*) as total_boxes,
    COUNT(DISTINCT user_id) as unique_users,
    SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_boxes,
    SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END) as opened_boxes
FROM boxes;

-- Show specific user stats
SELECT 
    u.name,
    u.email,
    COUNT(b.id) as total_boxes,
    SUM(CASE WHEN b.status = 'available' THEN 1 ELSE 0 END) as available,
    SUM(CASE WHEN b.status = 'opened' THEN 1 ELSE 0 END) as opened
FROM users u
LEFT JOIN boxes b ON u.id = b.user_id
WHERE u.role = 'customer'
GROUP BY u.id, u.name, u.email
ORDER BY total_boxes DESC
LIMIT 20;

COMMIT;
EOF

echo "Running box system fixes..."
echo ""

# Execute the fix
if [[ "$DATABASE_URL" == *"railway"* ]]; then
    psql "$DATABASE_URL" -f /tmp/fix-boxes.sql
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Box system fixed successfully!"
        echo ""
        echo "Summary of changes:"
        echo "- Fixed inconsistent box states (available but already opened)"
        echo "- Removed old unopened boxes (>30 days)"
        echo "- Limited users to max 3 available boxes"
        echo "- Granted fresh boxes to users who had none available"
        echo "- Reset box progress counters"
    else
        echo "❌ Error fixing box system"
    fi
else
    echo "ERROR: Not connected to Railway database"
fi

rm -f /tmp/fix-boxes.sql

echo ""
echo "Next step: Add box management UI to operations dashboard"