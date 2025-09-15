const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkMessages() {
  try {
    console.log('=== Checking OpenPhone Messages in Database ===\n');

    // 1. Check last 5 messages from any source
    const recentMessages = await pool.query(`
      SELECT 
        id,
        phone_number,
        customer_name,
        message_text,
        direction,
        created_at
      FROM openphone_conversations
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('Last 5 OpenPhone conversations:');
    if (recentMessages.rows.length === 0) {
      console.log('  No conversations found');
    } else {
      recentMessages.rows.forEach(msg => {
        const time = new Date(msg.created_at).toISOString().substring(0, 19);
        const text = msg.message_text ? msg.message_text.substring(0, 50) : 'null';
        console.log(`  ${time} | ${msg.phone_number} | ${msg.direction} | ${text}`);
      });
    }

    // 2. Check specifically for 902-478-3209
    const specificNumber = await pool.query(`
      SELECT 
        id,
        message_text,
        direction,
        created_at
      FROM openphone_conversations
      WHERE phone_number LIKE '%9024783209%' OR phone_number LIKE '%902%478%3209%'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('\nMessages from 902-478-3209:');
    if (specificNumber.rows.length === 0) {
      console.log('  No messages found from this number');
    } else {
      specificNumber.rows.forEach(msg => {
        console.log(`  ${new Date(msg.created_at).toISOString()} | ${msg.direction} | ${msg.message_text}`);
      });
    }

    // 3. Check conversation_messages table too
    const convMessages = await pool.query(`
      SELECT 
        conversation_id,
        message_text,
        sender_type,
        created_at
      FROM conversation_messages
      WHERE created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('\nRecent messages in conversation_messages:');
    if (convMessages.rows.length === 0) {
      console.log('  No recent messages in last hour');
    } else {
      convMessages.rows.forEach(msg => {
        const time = new Date(msg.created_at).toISOString().substring(0, 19);
        const text = msg.message_text ? msg.message_text.substring(0, 50) : 'null';
        console.log(`  ${time} | ${msg.sender_type} | ${text}`);
      });
    }

    await pool.end();
  } catch (error) {
    console.error('Database error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkMessages();
