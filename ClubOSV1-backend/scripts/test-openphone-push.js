#!/usr/bin/env node

/**
 * Test script for OpenPhone push notifications
 * Simulates an incoming OpenPhone message webhook to test push notifications
 */

require('dotenv').config();
const fetch = require('node-fetch');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const WEBHOOK_SECRET = process.env.OPENPHONE_WEBHOOK_SECRET;

// Test webhook payload
const webhookPayload = {
  type: 'message.created',
  data: {
    id: 'test-msg-' + Date.now(),
    conversationId: 'test-conv-123',
    from: '+1234567890',
    to: process.env.OPENPHONE_DEFAULT_NUMBER || '+19999999999',
    body: 'Hey, door won\'t open again. Can someone help?',
    direction: 'incoming',
    createdAt: new Date().toISOString(),
    contactName: 'Mike Test'
  }
};

async function testWebhook() {
  console.log('🚀 Testing OpenPhone webhook with push notifications...\n');
  
  console.log('Webhook payload:', JSON.stringify(webhookPayload, null, 2));
  
  try {
    // Generate signature if secret is available
    let headers = {
      'Content-Type': 'application/json'
    };
    
    if (WEBHOOK_SECRET) {
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookPayload))
        .digest('hex');
      headers['x-openphone-signature'] = signature;
      console.log('\n✅ Added webhook signature');
    }
    
    // Send webhook
    console.log('\n📤 Sending webhook to:', `${BACKEND_URL}/api/messaging/webhook`);
    const response = await fetch(`${BACKEND_URL}/api/messaging/webhook`, {
      method: 'POST',
      headers,
      body: JSON.stringify(webhookPayload)
    });
    
    const result = await response.json();
    console.log('\n📥 Response:', response.status, result);
    
    if (response.ok) {
      console.log('\n✅ Webhook processed successfully!');
      console.log('\n🔔 Push notifications should be sent to:');
      console.log('   - All admin users');
      console.log('   - All operator users');
      console.log('   - All support users');
      console.log('\n📱 Check your browser/device for the notification');
      console.log('   Title: "New OpenPhone Message"');
      console.log('   Body: "From Mike Test: \\"Hey, door won\'t open again. Can someone h...\\""');
      console.log('   Click action: Navigate to /messages');
    } else {
      console.error('\n❌ Webhook failed:', result);
    }
    
  } catch (error) {
    console.error('\n❌ Error testing webhook:', error.message);
  }
}

// Check if backend is running
async function checkBackend() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    if (!response.ok) {
      throw new Error('Backend not responding');
    }
    return true;
  } catch (error) {
    console.error('❌ Backend is not running at', BACKEND_URL);
    console.log('   Please start the backend first: npm run dev');
    return false;
  }
}

// Main
async function main() {
  console.log('ClubOS OpenPhone Push Notification Test');
  console.log('=====================================\n');
  
  if (!(await checkBackend())) {
    process.exit(1);
  }
  
  await testWebhook();
  
  console.log('\n\n💡 Troubleshooting:');
  console.log('   - Make sure you have push notifications enabled in your browser');
  console.log('   - Check that you\'re logged in as admin/operator/support');
  console.log('   - Verify VAPID keys are configured in .env');
  console.log('   - Check browser console for service worker logs');
  console.log('   - View notification history at /notifications/history (admin only)');
}

main().catch(console.error);