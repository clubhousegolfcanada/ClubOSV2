const axios = require('axios');

async function testOpenPhoneIntegration() {
  console.log('=== OpenPhone Integration Test ===\n');

  const backendUrl = 'https://clubosv2-production.up.railway.app';

  // Test 1: Backend Health
  console.log('1. Testing backend health...');
  try {
    const health = await axios.get(`${backendUrl}/health`);
    console.log('✅ Backend is healthy:', health.data);
  } catch (err) {
    console.log('❌ Backend health check failed:', err.message);
  }

  // Test 2: Messages endpoint health
  console.log('\n2. Testing messages endpoint...');
  try {
    const msgHealth = await axios.get(`${backendUrl}/api/messages/health`);
    console.log('✅ Messages endpoint healthy:', msgHealth.data.data);
  } catch (err) {
    console.log('❌ Messages endpoint failed:', err.message);
  }

  // Test 3: Send test webhook
  console.log('\n3. Sending test webhook...');
  const testWebhook = {
    type: 'message.received',
    data: {
      id: `test_${Date.now()}`,
      from: '+19022929623',
      to: ['+19027073748'],
      body: 'Test message from diagnostic script',
      direction: 'incoming',
      createdAt: new Date().toISOString(),
      contactName: 'Test User'
    }
  };

  try {
    const webhookResponse = await axios.post(
      `${backendUrl}/api/openphone/webhook`,
      testWebhook,
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log('✅ Webhook accepted:', webhookResponse.data);
  } catch (err) {
    console.log('❌ Webhook failed:', err.response?.data || err.message);
  }

  // Test 4: Check webhook in different formats
  console.log('\n4. Testing OpenPhone v3 wrapped format...');
  const wrappedWebhook = {
    object: {
      type: 'message.received',
      data: {
        id: `test_v3_${Date.now()}`,
        from: '+19022929623',
        to: ['+19027073748'],
        body: 'Test v3 wrapped message',
        direction: 'incoming',
        createdAt: new Date().toISOString()
      }
    }
  };

  try {
    const v3Response = await axios.post(
      `${backendUrl}/api/openphone/webhook`,
      wrappedWebhook,
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log('✅ V3 webhook accepted:', v3Response.data);
  } catch (err) {
    console.log('❌ V3 webhook failed:', err.response?.data || err.message);
  }

  // Test 5: Check if using correct endpoint
  console.log('\n5. Testing alternative endpoints...');
  try {
    const v3Endpoint = await axios.post(
      `${backendUrl}/api/openphone-v3/webhook-v3`,
      testWebhook,
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log('✅ V3 endpoint accepted:', v3Endpoint.data);
  } catch (err) {
    console.log('❌ V3 endpoint failed:', err.response?.status || err.message);
  }

  console.log('\n=== Test Complete ===');
  console.log('\nDiagnosis:');
  console.log('- Webhooks are reaching the backend (200 response)');
  console.log('- But messages may not be stored correctly');
  console.log('- Or frontend may not be fetching from correct table');
  console.log('\nCheck Railway logs for processing errors');
}

testOpenPhoneIntegration().catch(console.error);