#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing User Creation\n');

// First, we need to login to get a token
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

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.success) {
            console.log('✅ Logged in successfully');
            resolve(parsed.data.token);
          } else {
            reject(new Error('Login failed'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(loginData);
    req.end();
  });
};

// Test creating a user
const createUser = (token) => {
  return new Promise((resolve, reject) => {
    const newUser = {
      email: 'test@clubhouse247golf.com',
      password: 'TestPass123',
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

    console.log('\n📤 Sending create user request...');
    console.log('Data:', newUser);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\nStatus: ${res.statusCode}`);
        console.log('Response:');
        try {
          const parsed = JSON.parse(data);
          console.log(JSON.stringify(parsed, null, 2));
          
          if (res.statusCode === 201 || parsed.success) {
            console.log('\n✅ User created successfully!');
          } else {
            console.log('\n❌ Failed to create user');
          }
        } catch (e) {
          console.log(data);
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

// Run the test
const runTest = async () => {
  try {
    console.log('1️⃣ Getting auth token...');
    const token = await login();
    console.log('Token:', token.substring(0, 50) + '...\n');

    console.log('2️⃣ Testing user creation...');
    await createUser(token);

    console.log('\n3️⃣ Checking users file...');
    const usersPath = path.join(__dirname, 'ClubOSV1-backend/src/data/users.json');
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    console.log(`Total users in database: ${users.length}`);
    users.forEach(u => {
      console.log(`- ${u.email} (${u.role})`);
    });

  } catch (error) {
    console.error('Test failed:', error.message);
  }
};

runTest();
