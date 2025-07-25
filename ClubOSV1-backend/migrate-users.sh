#!/bin/bash

# ClubOS User Migration Script
# Migrates users from JSON files to PostgreSQL database

echo "🚀 ClubOS User Migration to PostgreSQL"
echo "======================================"
echo ""

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the ClubOSV1-backend directory"
    exit 1
fi

# Install required packages if not present
echo "📦 Checking dependencies..."
npm list sequelize >/dev/null 2>&1 || npm install sequelize
npm list pg >/dev/null 2>&1 || npm install pg pg-hstore
npm list bcryptjs >/dev/null 2>&1 || npm install bcryptjs

echo ""
echo "🔄 Running migration..."
echo ""

# Run the migration
node src/models/User.js

echo ""
echo "✅ Migration script complete!"
echo ""
echo "Next steps:"
echo "1. Update your auth routes to use the database instead of JSON files"
echo "2. Deploy to Railway"
echo "3. Your users will now persist between deployments!"
echo ""
echo "⚠️  IMPORTANT: Make sure your Railway environment has DATABASE_URL set"
