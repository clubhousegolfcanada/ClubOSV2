#!/usr/bin/env node

const http = require('http');

console.log('🧪 Testing ClubOSV1 Backend Login Endpoint\n');

const testLogin = (email, password) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    console.log(`Testing login for: ${email}`);
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
          const parsed = JSON.parse(responseData);
          console.log('Response:', JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log('Response:', responseData);
        }
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Error:', error.message);
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
};

const runTests = async () => {
  // Check if backend is running
  console.log('1️⃣ Checking if backend is running...');
  
  const checkBackend = () => {
    return new Promise((resolve) => {
      const req = http.get('http://localhost:3001/health', (res) => {
        resolve(true);
      });
      req.on('error', () => {
        resolve(false);
      });
    });
  };
  
  const isRunning = await checkBackend();
  
  if (!isRunning) {
    console.log('❌ Backend is not running!');
    console.log('\nStart it with:');
    console.log('cd ClubOSV1-backend');
    console.log('npm run dev');
    return;
  }
  
  console.log('✅ Backend is running\n');
  
  // Test login
  console.log('2️⃣ Testing login endpoint...\n');
  await testLogin('admin@clubhouse247golf.com', 'ClubhouseAdmin123!');
};

runTests();
