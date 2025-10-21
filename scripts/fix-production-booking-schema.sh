#!/bin/bash

# Fix Production Booking Schema
# This script runs the missing migration to add location_id column to bookings table

echo "================================================"
echo "Fixing Production Booking Schema"
echo "================================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from ClubOSV1-backend directory"
    exit 1
fi

echo "📦 Running migration 317_fix_booking_location_id.sql..."

# Run the migration in production using Railway
railway run npx tsx src/database/migrate.ts 317_fix_booking_location_id.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"

    echo ""
    echo "🔄 Restarting Railway service..."
    railway restart

    echo ""
    echo "⏳ Waiting for service to be healthy..."
    sleep 10

    # Test the health endpoint
    echo "🏥 Checking health status..."
    curl -s https://clubosv2-production.up.railway.app/health | jq '.'

    echo ""
    echo "✅ Production booking schema fixed!"
else
    echo "❌ Migration failed. Check Railway logs for details."
    echo "Run: railway logs"
    exit 1
fi

echo ""
echo "================================================"
echo "Next Steps:"
echo "1. Test booking endpoints in production"
echo "2. Monitor Railway logs: railway logs -f"
echo "================================================"