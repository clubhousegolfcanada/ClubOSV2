#!/usr/bin/env npx tsx

/**
 * Test script for OpenPhone webhook events
 * This simulates various webhook payloads to test message handling
 *
 * Usage: npx tsx scripts/test-openphone-webhook.ts
 */

import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5005';
const WEBHOOK_URL = `${BACKEND_URL}/api/openphone/webhook-test`;

// Test phone numbers
const OPERATOR_PHONE = '+17205551234'; // Operator's OpenPhone number
const CUSTOMER_PHONE = '+13035559876'; // Customer's phone number

// Helper to send webhook
async function sendWebhook(payload: any) {
  try {
    console.log('\n📤 Sending webhook:', JSON.stringify(payload, null, 2));
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-openphone-signature': 'test-signature'
      }
    });
    console.log('✅ Response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Test cases
async function runTests() {
  console.log('🧪 Starting OpenPhone Webhook Tests\n');
  console.log('Testing against:', WEBHOOK_URL);
  console.log('=====================================\n');

  // Test 1: Customer sends inbound message (message.received)
  console.log('Test 1: Inbound message from customer (message.received)');
  await sendWebhook({
    type: 'message.received',
    data: {
      id: 'msg_inbound_001',
      from: CUSTOMER_PHONE,
      to: OPERATOR_PHONE,
      body: 'Hello, I need help with my booking',
      direction: 'inbound',
      createdAt: new Date().toISOString(),
      conversationId: 'conv_test_001',
      userId: null,
      userName: null
    }
  });

  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Operator sends outbound message (message.delivered)
  console.log('\nTest 2: Outbound message from operator (message.delivered)');
  await sendWebhook({
    type: 'message.delivered',
    data: {
      id: 'msg_outbound_001',
      from: OPERATOR_PHONE,
      to: CUSTOMER_PHONE,
      body: 'Hi! I can help you with your booking. What date are you looking for?',
      direction: 'outbound',
      createdAt: new Date().toISOString(),
      conversationId: 'conv_test_001',
      userId: 'user_operator_001',
      userName: 'Mike Operator'
    }
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: message.delivered with 'to' as array (OpenPhone v3 format)
  console.log('\nTest 3: message.delivered with array format');
  await sendWebhook({
    type: 'message.delivered',
    data: {
      id: 'msg_outbound_002',
      from: OPERATOR_PHONE,
      to: [CUSTOMER_PHONE], // Array format
      body: 'Your booking has been confirmed for tomorrow at 2 PM.',
      direction: 'outbound',
      createdAt: new Date().toISOString(),
      conversationId: 'conv_test_001',
      userId: 'user_operator_001',
      userName: 'Mike Operator'
    }
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 4: message.delivered with wrapped object (some webhook versions)
  console.log('\nTest 4: message.delivered with wrapped object');
  await sendWebhook({
    object: {
      type: 'message.delivered',
      data: {
        id: 'msg_outbound_003',
        from: OPERATOR_PHONE,
        to: CUSTOMER_PHONE,
        body: 'Let me know if you need anything else!',
        direction: 'outbound',
        createdAt: new Date().toISOString(),
        conversationId: 'conv_test_001',
        userId: 'user_operator_001',
        userName: 'Mike Operator'
      }
    }
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 5: message.sent event (alternative to message.delivered)
  console.log('\nTest 5: message.sent event');
  await sendWebhook({
    type: 'message.sent',
    data: {
      id: 'msg_sent_001',
      from: OPERATOR_PHONE,
      to: CUSTOMER_PHONE,
      body: 'This message was sent via OpenPhone app',
      direction: 'outgoing', // Note: might be 'outgoing' instead of 'outbound'
      createdAt: new Date().toISOString(),
      conversationId: 'conv_test_002',
      userId: 'user_operator_001',
      userName: 'Mike Operator'
    }
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 6: Edge case - 'to' field as object
  console.log('\nTest 6: message.delivered with object format for to field');
  await sendWebhook({
    type: 'message.delivered',
    data: {
      id: 'msg_outbound_004',
      from: OPERATOR_PHONE,
      to: { phoneNumber: CUSTOMER_PHONE, name: 'Test Customer' },
      body: 'Testing object format for recipient',
      createdAt: new Date().toISOString(),
      conversationId: 'conv_test_003'
    }
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 7: Check debug endpoint to see stored messages
  console.log('\n\nTest 7: Checking stored conversations...');
  try {
    const debugResponse = await axios.get(`${BACKEND_URL}/api/openphone/debug/recent?limit=5`);
    console.log('📊 Recent conversations:', JSON.stringify(debugResponse.data, null, 2));
  } catch (error) {
    console.log('Could not fetch debug data (may require auth)');
  }

  console.log('\n\n=====================================');
  console.log('✅ All tests completed!');
  console.log('\nCheck the backend logs for detailed processing information.');
  console.log('Look for logs with 📤 emoji to see how outbound messages are processed.');
}

// Run tests
runTests().catch(console.error);