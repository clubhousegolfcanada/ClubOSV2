const { Pool } = require('pg');
const webpush = require('web-push');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function sendTestNotification(userEmail) {
  try {
    // Check VAPID configuration
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_EMAIL) {
      console.error('❌ VAPID keys not configured in environment');
      return;
    }
    
    // Configure web-push
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    
    // Find user
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE email = $1 OR id = $1',
      [userEmail]
    );
    
    if (userResult.rows.length === 0) {
      console.error('User not found:', userEmail);
      return;
    }
    
    const user = userResult.rows[0];
    console.log('Sending test notification to:', user.email);
    
    // Get active subscriptions
    const subscriptions = await pool.query(
      'SELECT * FROM push_subscriptions WHERE user_id = $1 AND is_active = true',
      [user.id]
    );
    
    if (subscriptions.rows.length === 0) {
      console.error('No active push subscriptions for user');
      return;
    }
    
    console.log(`Found ${subscriptions.rows.length} active subscriptions`);
    
    // Test notification payload
    const notification = {
      title: 'ClubOS Test Notification',
      body: 'This is a test notification. If you see this, push notifications are working!',
      icon: '/clubos-icon-192.png',
      badge: '/clubos-badge-72.png',
      tag: 'test-notification',
      data: {
        type: 'test',
        timestamp: Date.now()
      }
    };
    
    // Send to each subscription
    for (const sub of subscriptions.rows) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };
      
      try {
        console.log(`Sending to endpoint: ${sub.endpoint.substring(0, 50)}...`);
        const result = await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(notification)
        );
        console.log('✓ Notification sent successfully:', result.statusCode);
        
        // Log to history
        await pool.query(
          `INSERT INTO notification_history 
           (user_id, subscription_id, type, title, body, data, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [user.id, sub.id, 'test', notification.title, notification.body, notification.data, 'sent']
        );
        
      } catch (error) {
        console.error('❌ Failed to send notification:', error.message);
        if (error.statusCode === 410) {
          console.log('Subscription expired, marking as inactive');
          await pool.query(
            'UPDATE push_subscriptions SET is_active = false WHERE id = $1',
            [sub.id]
          );
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

// Get user email from command line
const userEmail = process.argv[2];
if (!userEmail) {
  console.log('Usage: node send-test-notification.js <user-email-or-id>');
  process.exit(1);
}

sendTestNotification(userEmail);