#!/bin/bash

# Emergency Fix for Booking Schema
# This script runs the critical migration to add missing columns to bookings table

echo "================================================"
echo "🚨 EMERGENCY BOOKING SCHEMA FIX"
echo "================================================"
echo ""

# Navigate to backend directory
cd "$(dirname "$0")/../ClubOSV1-backend" || exit 1

echo "📍 Current directory: $(pwd)"
echo ""

# Option 1: Run via migration system
echo "🔧 Option 1: Running via migration system..."
railway run npx tsx src/database/migrate.ts 318_add_missing_booking_columns.sql

if [ $? -ne 0 ]; then
    echo ""
    echo "⚠️ Migration system failed. Trying direct SQL..."
    echo ""

    # Option 2: Run direct SQL if migration system fails
    echo "🔧 Option 2: Running direct SQL..."
    railway run psql $DATABASE_URL < src/database/migrations/318_add_missing_booking_columns.sql

    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ Both methods failed. Manual intervention required."
        echo ""
        echo "Please run manually:"
        echo "  railway run psql \$DATABASE_URL < src/database/migrations/318_add_missing_booking_columns.sql"
        exit 1
    fi
fi

echo ""
echo "✅ Schema fix applied successfully!"
echo ""

# Test the endpoint
echo "🧪 Testing booking endpoint..."
echo ""

# Get today's date in YYYY-MM-DD format
TODAY=$(date +%Y-%m-%d)

# Test the booking day endpoint
echo "Testing: /api/bookings/day?date=$TODAY&locationId=bedford"
curl -s "https://clubosv2-production.up.railway.app/api/bookings/day?date=$TODAY&locationId=bedford" \
  -H "Accept: application/json" | head -c 200

echo ""
echo ""

# Check if the response contains an error
RESPONSE=$(curl -s "https://clubosv2-production.up.railway.app/api/bookings/day?date=$TODAY&locationId=bedford")

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Booking endpoint is working!"
elif echo "$RESPONSE" | grep -q '"success":false'; then
    echo "⚠️ Endpoint returned an error. Checking details..."
    echo "$RESPONSE" | jq '.error' 2>/dev/null || echo "$RESPONSE"
else
    echo "❓ Unexpected response format"
fi

echo ""
echo "================================================"
echo "📊 Schema Verification"
echo "================================================"

# Verify schema
railway run psql $DATABASE_URL -c "
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN ('space_ids', 'customer_name', 'customer_tier_id', 'location_id')
ORDER BY column_name;
"

echo ""
echo "================================================"
echo "✅ Emergency fix complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Monitor Railway logs: railway logs -f"
echo "2. Test booking creation in the UI"
echo "3. Verify calendar displays bookings correctly"
echo "================================================"