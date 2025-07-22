#!/usr/bin/env node

const http = require('http');

console.log('🔐 Testing Authentication Flow\n');

// Step 1: Login to get a fresh token
const login = () => {
  return new Promise((resolve, reject) => {
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
      }
    };

    console.log('1️⃣ Logging in...');
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
          const parsed = JSON.parse(data);
          if (parsed.success) {
            console.log('✅ Login successful');
            console.log('User:', parsed.data.user.email);
            console.log('Token:', parsed.data.token.substring(0, 50) + '...');
            resolve(parsed.data.token);
          } else {
            console.log('❌ Login failed:', parsed.message);
            reject(new Error(parsed.message));
          }
        } catch (e) {
          console.log('Response:', data);
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(loginData);
    req.end();
  });
};

// Step 2: Test the token with /auth/me endpoint
const testToken = (token) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/me',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    console.log('\n2️⃣ Testing token with /auth/me...');
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
          const parsed = JSON.parse(data);
          console.log('Response:', JSON.stringify(parsed, null, 2));
          
          if (res.statusCode === 200) {
            console.log('✅ Token is valid');
            resolve(true);
          } else {
            console.log('❌ Token validation failed');
            resolve(false);
          }
        } catch (e) {
          console.log('Response:', data);
          resolve(false);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
};

// Step 3: Try to create a user
const createUser = (token) => {
  return new Promise((resolve, reject) => {
    const newUser = {
      email: `test${Date.now()}@clubhouse247golf.com`,
      password: 'TestPassword123',
      name: 'Test User',
      role: 'operator'
    };

    const userData = JSON.stringify(newUser);

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': userData.length,
        'Authorization': `Bearer ${token}`
      }
    };

    console.log('\n3️⃣ Creating user...');
    console.log('New user email:', newUser.email);
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
          const parsed = JSON.parse(data);
          console.log('Response:', JSON.stringify(parsed, null, 2));
          
          if (res.statusCode === 201 || parsed.success) {
            console.log('✅ User created successfully!');
          } else {
            console.log('❌ Failed to create user');
          }
        } catch (e) {
          console.log('Response:', data);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`❌ Error: ${e.message}`);
      reject(e);
    });

    req.write(userData);
    req.end();
  });
};

// Run all tests
const runTests = async () => {
  try {
    // Get a fresh token
    const token = await login();
    
    // Test if token works
    await testToken(token);
    
    // Try to create a user
    await createUser(token);
    
    console.log('\n📋 Summary:');
    console.log('If you see "invalid token" errors, the JWT configuration might be wrong.');
    console.log('Check that JWT_SECRET in .env matches what the backend expects.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
};

runTests();
