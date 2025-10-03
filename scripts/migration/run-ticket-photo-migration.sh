#!/bin/bash

echo "Running ticket photo migration..."

# Navigate to backend directory
cd "$(dirname "$0")/../ClubOSV1-backend" || exit

# Run the migration using Railway
railway run npx tsx -e "
const { pool } = require('./src/utils/db');

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Adding photo_urls column to tickets table...');

    // Add the column if it doesn't exist
    await client.query(\`
      ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}'
    \`);

    console.log('Column added successfully');

    // Create index for performance
    await client.query(\`
      CREATE INDEX IF NOT EXISTS idx_tickets_has_photos
      ON tickets ((array_length(photo_urls, 1) > 0))
    \`);

    console.log('Index created successfully');

    // Add comment
    await client.query(\`
      COMMENT ON COLUMN tickets.photo_urls IS 'Array of photo URLs (base64 data URLs or external URLs) attached to the ticket for visual documentation'
    \`);

    console.log('✅ Ticket photo migration completed successfully');

    // Verify the column exists
    const result = await client.query(\`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'tickets'
      AND column_name = 'photo_urls'
    \`);

    if (result.rows.length > 0) {
      console.log('✅ Verified: photo_urls column exists with type:', result.rows[0].data_type);
    } else {
      console.log('⚠️ Warning: photo_urls column not found after migration');
    }

  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
"

echo "Migration script completed"