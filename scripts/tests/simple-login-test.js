#!/usr/bin/env node

const http = require('http');

console.log('🧪 Simple Login Test\n');

// Test data
const loginData = JSON.stringify({
  email: 'admin@clubhouse247golf.com',
  password: 'ClubhouseAdmin123!'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  },
  timeout: 5000
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse:');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.success && parsed.data && parsed.data.token) {
        console.log('\n✅ Login successful!');
        console.log('Token:', parsed.data.token.substring(0, 50) + '...');
        console.log('\nYou can now login at http://localhost:3000/login');
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Error: ${e.message}`);
  if (e.code === 'ECONNREFUSED') {
    console.log('\nMake sure the backend is running on port 3001');
  }
});

req.on('timeout', () => {
  console.error('❌ Request timed out');
  req.destroy();
});

console.log('Sending login request...\n');
req.write(loginData);
req.end();
