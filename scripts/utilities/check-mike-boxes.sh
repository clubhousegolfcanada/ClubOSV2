#!/bin/bash

# Check Mike Belair's box status in the database

echo "🔍 Checking Mike Belair's box status..."
echo "========================================"

# Get database URL from backend .env
BACKEND_DIR="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend"
source "$BACKEND_DIR/.env"

# Mike Belair's user ID (from previous data)
MIKE_ID="6fec2a21-64e0-403c-9ba2-cb88a0b97a4d"

# Create SQL script to check box status
cat > /tmp/check-boxes.sql << EOF
-- Check Mike's user account
SELECT id, email, name, created_at 
FROM users 
WHERE id = '$MIKE_ID';

-- Check all boxes for Mike
SELECT 
    b.id,
    b.status,
    b.created_at,
    b.opened_at,
    b.expires_at,
    b.reward_type,
    b.reward_value
FROM boxes b
WHERE b.user_id = '$MIKE_ID'
ORDER BY b.created_at DESC;

-- Check box progress
SELECT * FROM box_progress 
WHERE user_id = '$MIKE_ID';

-- Check if there are any box rewards
SELECT * FROM box_rewards 
WHERE box_id IN (SELECT id FROM boxes WHERE user_id = '$MIKE_ID');

-- Count boxes by status
SELECT 
    status,
    COUNT(*) as count
FROM boxes 
WHERE user_id = '$MIKE_ID'
GROUP BY status;

-- Check for any boxes that appear available but have been opened
SELECT 
    id,
    status,
    opened_at,
    CASE 
        WHEN status = 'available' AND opened_at IS NOT NULL THEN 'INCONSISTENT'
        WHEN status = 'opened' AND opened_at IS NULL THEN 'INCONSISTENT'
        ELSE 'OK'
    END as data_check
FROM boxes 
WHERE user_id = '$MIKE_ID';
EOF

echo "Running database queries..."
echo ""

# Use Railway database
if [[ "$DATABASE_URL" == *"railway"* ]]; then
    echo "Connecting to Railway database..."
    psql "$DATABASE_URL" -f /tmp/check-boxes.sql
else
    echo "ERROR: Not connected to Railway database"
    echo "DATABASE_URL: $DATABASE_URL"
fi

rm -f /tmp/check-boxes.sql

echo ""
echo "✅ Database check complete!"