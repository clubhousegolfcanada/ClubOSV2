#!/bin/bash

# Run NinjaOne migration on Railway
echo "Running NinjaOne migration..."

railway run sh -c 'psql "$DATABASE_URL" < src/database/migrations/208_ninjaone_dynamic_registry.sql'

echo "Migration complete!"
echo "Recording migration in database..."

railway run sh -c 'psql "$DATABASE_URL" -c "INSERT INTO migrations (filename, executed_at, checksum) VALUES ('"'"'208_ninjaone_dynamic_registry.sql'"'"', NOW(), '"'"'ninjaone-tables'"'"') ON CONFLICT (filename) DO NOTHING"'

echo "Done!"