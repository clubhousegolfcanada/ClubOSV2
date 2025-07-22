#!/usr/bin/env node

const http = require('http');

console.log('🔍 Debugging ClubOSV1 Backend\n');

// Simple GET request to health endpoint
const testHealth = () => {
  return new Promise((resolve) => {
    console.log('Testing GET /health...');
    
    http.get('http://localhost:3001/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ Health endpoint works:', data);
        resolve(true);
      });
    }).on('error', (err) => {
      console.log('❌ Health endpoint error:', err.message);
      resolve(false);
    });
  });
};

// Test if auth routes exist
const testAuthRoute = () => {
  return new Promise((resolve) => {
    console.log('\nTesting GET /api/auth/login (should return 404 or error)...');
    
    http.get('http://localhost:3001/api/auth/login', (res) => {
      console.log(`Status: ${res.statusCode}`);
      console.log('✅ Auth routes are loaded');
      resolve(true);
    }).on('error', (err) => {
      console.log('❌ Auth routes error:', err.message);
      resolve(false);
    });
  });
};

// Test POST with minimal data
const testMinimalPost = () => {
  return new Promise((resolve) => {
    console.log('\nTesting POST /api/auth/login with empty body...');
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': 2
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log('Response:', data.substring(0, 100));
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ Error:', err.message);
      resolve();
    });
    
    req.write('{}');
    req.end();
  });
};

// Run all tests
const runTests = async () => {
  await testHealth();
  await testAuthRoute();
  await testMinimalPost();
  
  console.log('\n📋 Next steps:');
  console.log('1. Check the backend terminal for error messages');
  console.log('2. Make sure all dependencies are installed: npm install');
  console.log('3. Check that JWT_SECRET is set in .env file');
};

runTests();
