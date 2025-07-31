const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testPushNotification() {
  try {
    // Check VAPID keys
    console.log('Checking VAPID configuration...');
    console.log('VAPID_PUBLIC_KEY:', process.env.VAPID_PUBLIC_KEY ? '✓ Set' : '✗ Missing');
    console.log('VAPID_PRIVATE_KEY:', process.env.VAPID_PRIVATE_KEY ? '✓ Set' : '✗ Missing');
    console.log('VAPID_EMAIL:', process.env.VAPID_EMAIL ? '✓ Set' : '✗ Missing');
    
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_EMAIL) {
      console.error('\n❌ VAPID keys are not properly configured. Push notifications will not work.');
      return;
    }
    
    // Check push subscriptions
    console.log('\nChecking push subscriptions...');
    const subscriptions = await pool.query(`
      SELECT 
        ps.id,
        ps.user_id,
        ps.endpoint,
        ps.is_active,
        ps.failed_attempts,
        ps.created_at,
        ps.last_used_at,
        u.email as user_email
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.id
      WHERE ps.is_active = true
      ORDER BY ps.last_used_at DESC
    `);
    
    console.log(`Found ${subscriptions.rows.length} active push subscriptions:`);
    subscriptions.rows.forEach(sub => {
      console.log(`  - User: ${sub.user_email}`);
      console.log(`    Endpoint: ${sub.endpoint.substring(0, 50)}...`);
      console.log(`    Failed attempts: ${sub.failed_attempts}`);
      console.log(`    Last used: ${sub.last_used_at || 'Never'}`);
    });
    
    if (subscriptions.rows.length === 0) {
      console.log('\n❌ No active push subscriptions found. Users need to enable notifications first.');
      return;
    }
    
    // Check recent notification history
    console.log('\nChecking recent notification history...');
    const history = await pool.query(`
      SELECT 
        nh.*,
        u.email as user_email
      FROM notification_history nh
      LEFT JOIN users u ON nh.user_id = u.id
      ORDER BY nh.sent_at DESC
      LIMIT 10
    `);
    
    if (history.rows.length > 0) {
      console.log(`\nLast ${history.rows.length} notifications:`);
      history.rows.forEach(notif => {
        console.log(`  - ${notif.sent_at}: ${notif.title}`);
        console.log(`    User: ${notif.user_email || 'Unknown'}`);
        console.log(`    Status: ${notif.status}`);
        if (notif.error) console.log(`    Error: ${notif.error}`);
      });
    } else {
      console.log('No notification history found.');
    }
    
    // Test sending a notification
    const testUserId = subscriptions.rows[0]?.user_id;
    if (testUserId) {
      console.log(`\nWould you like to send a test notification to ${subscriptions.rows[0].user_email}?`);
      console.log('Run: node scripts/send-test-notification.js ' + testUserId);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

testPushNotification();