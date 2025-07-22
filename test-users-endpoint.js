#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing User List Endpoint\n');

// First login to get token
const login = async () => {
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

// Test getting users list
const getUsers = async (token) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/users',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    console.log('\n📋 Getting users list...');
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log('Response:');
        try {
          const parsed = JSON.parse(data);
          console.log(JSON.stringify(parsed, null, 2));
          
          if (res.statusCode === 200 && parsed.success) {
            console.log(`\n✅ Successfully loaded ${parsed.data.length} users`);
          } else {
            console.log('\n❌ Failed to load users');
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

    req.end();
  });
};

// Check what's in the users file
const checkUsersFile = () => {
  console.log('\n📁 Checking users.json file...');
  const usersPath = path.join(__dirname, 'ClubOSV1-backend/src/data/users.json');
  
  try {
    const data = fs.readFileSync(usersPath, 'utf-8');
    const users = JSON.parse(data);
    console.log(`Found ${users.length} users in database`);
    users.forEach(u => {
      console.log(`- ${u.email} (${u.role})`);
    });
  } catch (error) {
    console.error('Error reading users file:', error.message);
  }
};

// Run tests
const runTests = async () => {
  try {
    // Check the users file first
    checkUsersFile();
    
    // Login and get token
    const token = await login();
    console.log('Token:', token.substring(0, 50) + '...');
    
    // Try to get users
    await getUsers(token);
    
  } catch (error) {
    console.error('\nTest failed:', error.message);
  }
};

runTests();
