const crypto = require('crypto');
const axios = require('axios');

// Current webhook secret from Railway
const webhookSecret = 'SHBoVU1XaExTUlFsTkxsYUUxcHFIc1VkN215eUhsTmc=';

// Decode the base64 secret
const decodedSecret = Buffer.from(webhookSecret, 'base64').toString('utf8');
console.log('Decoded secret:', decodedSecret);

// Test payload matching OpenPhone format
const payload = {
  object: {
    type: 'message.created',
    data: {
      id: 'msg_test_' + Date.now(),
      text: 'test',
      direction: 'incoming',
      from: '+19024783209',
      to: '+19027073748',
      createdAt: new Date().toISOString(),
      conversationId: 'conv_test',
      userId: 'user_test'
    }
  }
};

const payloadString = JSON.stringify(payload);

// Generate signature with decoded secret
const signature = crypto.createHmac('sha256', decodedSecret).update(payloadString).digest('hex');

console.log('\nTesting webhook with signature...');
console.log('Payload:', JSON.stringify(payload, null, 2));
console.log('Signature:', signature);

// Send test webhook
axios.post(
  'https://clubosv2-production.up.railway.app/api/openphone/webhook',
  payload,
  {
    headers: {
      'Content-Type': 'application/json',
      'x-openphone-signature': signature
    }
  }
).then(response => {
  console.log('\n✅ Response:', response.status, response.data);
}).catch(error => {
  console.log('\n❌ Error:', error.response?.status, error.response?.data || error.message);
});
