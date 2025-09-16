const { Client } = require('pg');
require('dotenv').config();

async function fixOpenPhoneColumns() {
  console.log('=====================================');
  console.log('Fixing OpenPhone Missing Columns');
  console.log('=====================================\n');

  // Get DATABASE_URL from Railway environment
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found. Please run with Railway: railway run node scripts/fix-openphone-columns.js');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database\n');

    // Add missing columns
    console.log('Adding missing columns...');
    const alterTableQuery = `
      ALTER TABLE openphone_conversations
      ADD COLUMN IF NOT EXISTS operator_active BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS operator_last_message TIMESTAMP,
      ADD COLUMN IF NOT EXISTS conversation_locked BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMP,
      ADD COLUMN IF NOT EXISTS rapid_message_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ai_response_count INTEGER DEFAULT 0;
    `;

    await client.query(alterTableQuery);
    console.log('✅ Columns added successfully\n');

    // Add indexes
    console.log('Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_openphone_operator_active
      ON openphone_conversations(operator_active)
      WHERE operator_active = true;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_openphone_lockout
      ON openphone_conversations(lockout_until)
      WHERE lockout_until > NOW();
    `);
    console.log('✅ Indexes created\n');

    // Verify columns were added
    console.log('Verifying columns...');
    const verifyResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'openphone_conversations'
      AND column_name IN (
        'operator_active',
        'operator_last_message',
        'conversation_locked',
        'lockout_until',
        'rapid_message_count',
        'ai_response_count'
      )
    `);

    console.log('✅ Found columns:', verifyResult.rows.map(r => r.column_name).join(', '));

    if (verifyResult.rows.length === 6) {
      console.log('\n✅ SUCCESS! All missing columns have been added.');
      console.log('OpenPhone webhooks should now work correctly!');
    } else {
      console.log(`\n⚠️ Warning: Only ${verifyResult.rows.length}/6 columns were added.`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n=====================================');
    console.log('Fix complete!');
    console.log('=====================================');
  }
}

// Test webhook after fix
async function testWebhook() {
  console.log('\nTesting webhook...');
  const axios = require('axios');

  try {
    const response = await axios.post(
      'https://clubosv2-production.up.railway.app/api/openphone/webhook',
      {
        type: 'message.received',
        data: {
          id: `test_${Date.now()}`,
          from: '+19022929623',
          to: ['+19027073748'],
          body: 'Test message after fix',
          direction: 'incoming',
          createdAt: new Date().toISOString(),
          contactName: 'Test User'
        }
      }
    );

    if (response.data.received && !response.data.error) {
      console.log('✅ Webhook test PASSED! Messages should now appear in ClubOS.');
    } else if (response.data.error) {
      console.log('⚠️ Webhook still has errors:', response.data.error);
      console.log('Check Railway logs for details.');
    }
  } catch (err) {
    console.log('❌ Webhook test failed:', err.message);
  }
}

// Run the fix
fixOpenPhoneColumns()
  .then(() => testWebhook())
  .catch(console.error);