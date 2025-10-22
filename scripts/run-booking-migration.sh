#!/bin/bash

# Run Booking System Migration 319
# This script runs the critical booking table rebuild migration

echo "=========================================="
echo "Running Booking System Migration 319"
echo "=========================================="

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set. Please set it in your environment."
    exit 1
fi

echo "🔄 Running migration 319_booking_system_clean_rebuild.sql..."

# Run the migration using psql
psql "$DATABASE_URL" < src/database/migrations/319_booking_system_clean_rebuild.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo ""
    echo "📊 Verifying new schema..."
    psql "$DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bookings' AND column_name IN ('space_ids', 'start_at', 'end_at') ORDER BY ordinal_position;"
else
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi

echo ""
echo "✅ Booking system migration complete!"
echo "The booking table has been rebuilt with the correct schema."