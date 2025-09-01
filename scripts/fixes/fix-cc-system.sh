#!/bin/bash

# Fix Club Coins System - Update total_cc_earned when adjusting balance

echo "🔧 Fixing Club Coins System"
echo "==========================="

# Get database URL from backend .env
BACKEND_DIR="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend"
source "$BACKEND_DIR/.env"

# Create fix SQL
cat > /tmp/fix-cc-system.sql << 'EOF'
-- Start transaction
BEGIN;

-- Step 1: Show current CC statistics
SELECT 
    'Current CC Statistics' as report,
    COUNT(*) as total_users,
    COUNT(CASE WHEN cc_balance > 0 THEN 1 END) as users_with_balance,
    COUNT(CASE WHEN total_cc_earned > 0 THEN 1 END) as users_with_earnings,
    SUM(cc_balance) as total_balance,
    SUM(total_cc_earned) as total_earned,
    AVG(cc_balance) as avg_balance,
    AVG(total_cc_earned) as avg_earned
FROM customer_profiles;

-- Step 2: Show discrepancies
SELECT 
    'Users with balance > earned (indicates missing earned updates)' as issue,
    u.name,
    u.email,
    cp.cc_balance,
    cp.total_cc_earned,
    cp.cc_balance - cp.total_cc_earned as difference
FROM customer_profiles cp
JOIN users u ON cp.user_id = u.id
WHERE cp.cc_balance > cp.total_cc_earned
ORDER BY difference DESC
LIMIT 10;

-- Step 3: Fix total_cc_earned for users where balance > earned
-- This indicates admin credits that weren't added to total_cc_earned
UPDATE customer_profiles
SET total_cc_earned = cc_balance
WHERE cc_balance > total_cc_earned;

-- Step 4: Ensure total_cc_earned is never less than cc_balance
-- (You can't have more current balance than you've ever earned)
UPDATE customer_profiles
SET total_cc_earned = GREATEST(total_cc_earned, cc_balance)
WHERE total_cc_earned < cc_balance;

-- Step 5: Show results after fix
SELECT 
    'After Fix - CC Statistics' as report,
    COUNT(*) as total_users,
    COUNT(CASE WHEN cc_balance > 0 THEN 1 END) as users_with_balance,
    COUNT(CASE WHEN total_cc_earned > 0 THEN 1 END) as users_with_earnings,
    SUM(cc_balance) as total_balance,
    SUM(total_cc_earned) as total_earned
FROM customer_profiles;

-- Step 6: Show top users by total_cc_earned (for leaderboard)
SELECT 
    'Top 10 Users by Total CC Earned' as report,
    u.name,
    cp.cc_balance as current_balance,
    cp.total_cc_earned as lifetime_earned,
    cp.total_challenges_won as wins,
    cp.total_challenges_played as played
FROM customer_profiles cp
JOIN users u ON cp.user_id = u.id
WHERE u.role = 'customer'
ORDER BY cp.total_cc_earned DESC
LIMIT 10;

COMMIT;

-- Note: The CC adjustment endpoint needs to be updated to also increment total_cc_earned
EOF

echo "Running CC system fixes..."
echo ""

# Execute the fix
if [[ "$DATABASE_URL" == *"railway"* ]]; then
    psql "$DATABASE_URL" -f /tmp/fix-cc-system.sql
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ CC system data fixed!"
        echo ""
        echo "What was fixed:"
        echo "- Updated total_cc_earned to match cc_balance where needed"
        echo "- Ensured total_cc_earned is never less than current balance"
        echo ""
        echo "Next: Need to update the CC adjustment API to also update total_cc_earned"
    else
        echo "❌ Error fixing CC system"
    fi
else
    echo "ERROR: Not connected to Railway database"
fi

rm -f /tmp/fix-cc-system.sql