#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

// Simple test to check if the server is responding
async function testAuth() {
  console.log('Testing ClubOS Authentication System\n');
  
  // Test 1: Check if server is running
  try {
    console.log('1. Testing server health...');
    const health = await axios.get('http://localhost:3001/health');
    console.log('✅ Server is running:', health.data);
  } catch (error) {
    console.error('❌ Server is not running!');
    console.error('Please start the backend server first.');
    return;
  }

  // Test 2: Login as admin
  try {
    console.log('\n2. Testing admin login...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@clubhouse247golf.com',
      password: 'Admin123!@#'
    });

    const { token, user } = loginResponse.data.data;
    console.log('✅ Login successful');
    console.log('   User:', user.email);
    console.log('   Role:', user.role);
    console.log('   Token:', token.substring(0, 50) + '...');

    // Test 3: Get current user
    console.log('\n3. Testing /auth/me endpoint...');
    const meResponse = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Current user retrieved:', meResponse.data.data.email);

    // Test 4: List users
    console.log('\n4. Testing user list (admin only)...');
    const usersResponse = await axios.get(`${API_URL}/auth/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Users retrieved:', usersResponse.data.data.length, 'users');

    // Test 5: Create a new user
    console.log('\n5. Testing user creation...');
    const timestamp = Date.now();
    const newUser = {
      email: `test${timestamp}@trackhouse.com`,
      password: 'TestPassword123',
      name: `Test User ${timestamp}`,
      role: 'operator'
    };

    console.log('   Creating user:', newUser.email);
    
    try {
      const createResponse = await axios.post(
        `${API_URL}/auth/register`,
        newUser,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (createResponse.data.success) {
        console.log('✅ User created successfully!');
        console.log('   New user ID:', createResponse.data.data.id);
        console.log('   Email:', createResponse.data.data.email);
        console.log('   Role:', createResponse.data.data.role);
      }
    } catch (createError) {
      console.error('❌ Failed to create user');
      console.error('   Status:', createError.response?.status);
      console.error('   Error:', createError.response?.data);
      
      // Log detailed error information
      if (createError.response?.data?.errors) {
        console.error('   Validation errors:');
        createError.response.data.errors.forEach(err => {
          console.error(`     - ${err.field}: ${err.message}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testAuth();
