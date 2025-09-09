#!/bin/bash

echo "Running enhanced checklist migration on production database..."

# Load environment variables
source .env

# Extract just the UP part of the migration
sed -n '/-- UP/,/-- DOWN/p' src/database/migrations/219_enhanced_checklists.sql | grep -v '-- DOWN' > /tmp/migration_up.sql

# Run the migration directly
psql "$DATABASE_URL" < /tmp/migration_up.sql

# Clean up
rm /tmp/migration_up.sql

echo "Migration complete!"
echo "Enhanced checklist features are now available:"
echo "- Supplies tracking"
echo "- Photo attachments" 
echo "- Performance metrics"
echo "- QR code support"