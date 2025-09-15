const crypto = require('crypto');
const axios = require('axios');

// Test with the fixed signature verification
async function testWebhook() {
  const webhookSecret = 'TmM4aFZrdDk1UEdUYURDZEVja3g3aWtGUTlsTXYyVnY=';
  const decodedSecret = Buffer.from(webhookSecret, 'base64').toString('utf8');
  
  const payload = {
    object: {
      type: 'message.created',
      data: {
        id: 'test_' + Date.now(),
        text: 'Test webhook validation',
        direction: 'incoming',
        from: '+1234567890',
        to: '+19027073748',
        createdAt: new Date().toISOString()
      }
    }
  };
  
  const payloadString = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', decodedSecret).update(payloadString).digest('hex');
  
  console.log('Sending test webhook with proper signature...');
  console.log('Signature:', signature);
  
  try {
    const response = await axios.post(
      'https://clubosv2-production.up.railway.app/api/openphone/webhook',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-openphone-signature': signature
        }
      }
    );
    console.log('Response:', response.status, response.data);
  } catch (error) {
    console.log('Error:', error.response?.status, error.response?.data || error.message);
  }
}

testWebhook();
