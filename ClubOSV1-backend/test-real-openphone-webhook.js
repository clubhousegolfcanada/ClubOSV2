const axios = require('axios');

// Test without signature to see if OpenPhone is even hitting the endpoint
console.log('Testing webhook without signature (as if from OpenPhone)...\n');

const payload = {
  object: {
    type: 'message.created',
    data: {
      id: 'msg_' + Date.now(),
      text: 'test message from investigation',
      direction: 'incoming',
      from: '+19024783209',
      to: '+19027073748',
      createdAt: new Date().toISOString()
    }
  }
};

// First test: without signature (to see error message)
axios.post(
  'https://clubosv2-production.up.railway.app/api/openphone/webhook',
  payload,
  {
    headers: {
      'Content-Type': 'application/json'
    }
  }
).then(response => {
  console.log('Response WITHOUT signature:', response.status, response.data);
}).catch(error => {
  console.log('Error WITHOUT signature:', error.response?.status, error.response?.data);
});

// Second test: Check if webhook is even being called
setTimeout(() => {
  axios.post(
    'https://clubosv2-production.up.railway.app/api/openphone/webhook-debug',
    payload,
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  ).then(response => {
    console.log('\nDebug endpoint response:', response.status, response.data);
  }).catch(error => {
    console.log('\nDebug endpoint error:', error.response?.status, error.response?.data);
  });
}, 1000);
