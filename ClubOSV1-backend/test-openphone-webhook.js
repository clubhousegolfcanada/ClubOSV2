const crypto = require('crypto');

// Test webhook secret (from Railway)
const webhookSecret = 'TmM4aFZrdDk1UEdUYURDZEVja3g3aWtGUTlsTXYyVnY=';

// Test payload
const payload = JSON.stringify({
  object: {
    type: 'message.created',
    data: {
      id: 'test123',
      text: 'Test message',
      direction: 'incoming',
      from: '+1234567890',
      to: '+19027073748',
      createdAt: new Date().toISOString()
    }
  }
});

// Test 1: Treat secret as base64
console.log('Test 1: Secret as Base64');
const decodedSecret = Buffer.from(webhookSecret, 'base64').toString('utf8');
const signature1 = crypto.createHmac('sha256', decodedSecret).update(payload).digest('hex');
console.log('Decoded secret:', decodedSecret);
console.log('Signature (hex):', signature1);

// Test 2: Treat secret as raw string
console.log('\nTest 2: Secret as Raw String');
const signature2 = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
console.log('Signature (hex):', signature2);

// Test 3: Base64 signature
console.log('\nTest 3: Base64 Signature');
const signature3 = crypto.createHmac('sha256', webhookSecret).update(payload).digest('base64');
console.log('Signature (base64):', signature3);
