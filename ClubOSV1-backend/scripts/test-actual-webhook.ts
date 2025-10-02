#!/usr/bin/env npx tsx

/**
 * Test the EXACT webhook payload from OpenPhone
 */

import axios from 'axios';

const BACKEND_URL = 'http://localhost:5005';

// The EXACT payload from the user
const actualWebhook = {
  "object": {
    "id": "EVf437ff6b8a924f6c905c55667f0c3860",
    "object": "event",
    "createdAt": "2025-10-02T16:56:29.541Z",
    "apiVersion": "v3",
    "type": "message.delivered",
    "data": {
      "object": {
        "id": "msg_test_001",
        "object": "message",
        "from": "+19027073748",
        "to": "+19024783209",
        "createdBy": "US5pWhhg5r",
        "direction": "outgoing",
        "body": "test 1 2",
        "media": [],
        "status": "delivered",
        "createdAt": "2025-10-02T16:56:25.802Z",
        "userId": "US5pWhhg5r",
        "phoneNumberId": "PNsrXButS8",
        "conversationId": "conv_test_001"
      }
    }
  }
};

async function testWebhook() {
  console.log('🧪 Testing ACTUAL OpenPhone webhook payload\n');

  try {
    // Test the actual webhook endpoint
    console.log('📤 Sending to actual webhook endpoint: /api/openphone/webhook');
    const response = await axios.post(`${BACKEND_URL}/api/openphone/webhook`, actualWebhook, {
      headers: {
        'Content-Type': 'application/json',
        'x-openphone-signature': 'test-signature'
      }
    });

    console.log('✅ Response:', response.data);
    console.log('\n✅ Webhook processed successfully!');

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response?.status === 500) {
      console.log('\n⚠️ Server error - check backend logs for details');
    }
  }

  // Also test the test endpoint
  console.log('\n📤 Sending to test endpoint: /api/openphone/webhook-test');
  try {
    const testResponse = await axios.post(`${BACKEND_URL}/api/openphone/webhook-test`, actualWebhook, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Test endpoint response:', JSON.stringify(testResponse.data, null, 2));
  } catch (error: any) {
    console.error('❌ Test endpoint error:', error.message);
  }
}

testWebhook().catch(console.error);