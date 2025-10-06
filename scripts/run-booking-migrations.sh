#!/bin/bash

# Run booking system migrations in production
# This script runs all booking-related migrations that haven't been applied yet

set -e

echo "🚀 Running booking system migrations in production..."
echo "=================================================="

# Change to backend directory where .env file is located
cd ClubOSV1-backend

# Load environment variables from .env
source .env

# List of booking migration files to run
MIGRATIONS=(
  "015_booking_system.sql"
  "024_booking_system_enhancements.sql"
  "235_multi_simulator_booking.sql"
  "238_booking_system_comprehensive.sql"
  "240_booking_locations.sql"
  "250_booking_exclusion_constraint.sql"
  "301_booking_system_part3.sql"
)

for migration in "${MIGRATIONS[@]}"; do
  echo "📝 Running migration: $migration"

  # Check if migration already exists
  EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM migrations WHERE filename = '$migration';" 2>/dev/null || echo "0")

  if [ "$EXISTS" -gt "0" ]; then
    echo "  ✅ Already applied, skipping..."
  else
    echo "  ⚙️  Applying migration..."

    # Extract just the UP part if the migration has UP/DOWN sections
    if grep -q "-- UP" "src/database/migrations/$migration"; then
      sed -n '/-- UP/,/-- DOWN/p' "src/database/migrations/$migration" | grep -v '-- DOWN' > /tmp/migration_up.sql
      psql "$DATABASE_URL" < /tmp/migration_up.sql
      rm /tmp/migration_up.sql
    else
      psql "$DATABASE_URL" < "src/database/migrations/$migration"
    fi

    # Record the migration
    psql "$DATABASE_URL" -c "INSERT INTO migrations (filename, executed_at) VALUES ('$migration', NOW()) ON CONFLICT (filename) DO NOTHING;"

    echo "  ✅ Applied successfully!"
  fi
  echo ""
done

echo "✨ All booking migrations complete!"
echo ""
echo "📊 Checking database state..."

# Check if tables were created
psql "$DATABASE_URL" -c "
SELECT
  'booking_locations' as table_name, COUNT(*) as record_count FROM booking_locations
UNION ALL
SELECT
  'booking_spaces', COUNT(*) FROM booking_spaces
UNION ALL
SELECT
  'customer_tiers', COUNT(*) FROM customer_tiers
UNION ALL
SELECT
  'bookings', COUNT(*) FROM bookings;
"

echo ""
echo "🎉 Booking system database setup complete!"