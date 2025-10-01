#!/bin/bash

echo "🔄 Running Google OAuth Migration (233) in Production"
echo "================================================"

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

# Run the migration directly on Railway using psql
echo "📦 Applying migration 233_add_google_oauth_support.sql..."

railway run psql $DATABASE_URL < ClubOSV1-backend/src/database/migrations/233_add_google_oauth_support.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo ""
    echo "📊 Verifying columns were added..."
    railway run psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('google_id', 'auth_provider', 'oauth_email', 'email_verified');"
else
    echo "❌ Migration failed!"
    exit 1
fi