#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

// Test user creation
async function testUserCreation() {
  try {
    console.log('Testing user creation flow...\n');

    // Step 1: Login as admin
    console.log('1. Logging in as admin...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@trackhouse.com',
      password: 'Trackhouse2024!'
    });

    if (!loginResponse.data.success) {
      throw new Error('Login failed');
    }

    const token = loginResponse.data.data.token;
    console.log('✅ Login successful');
    console.log('Token:', token.substring(0, 20) + '...');
    console.log('User:', loginResponse.data.data.user.email);
    console.log('Role:', loginResponse.data.data.user.role);

    // Step 2: Try to create a new user
    console.log('\n2. Creating new user...');
    const newUser = {
      email: 'testuser@trackhouse.com',
      password: 'TestPass123!',
      name: 'Test User',
      role: 'operator'
    };

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

      console.log('✅ User created successfully');
      console.log('New user:', createResponse.data.data);
    } catch (error) {
      console.error('❌ Failed to create user');
      console.error('Status:', error.response?.status);
      console.error('Error:', error.response?.data);
      console.error('Headers sent:', {
        'Authorization': `Bearer ${token.substring(0, 20)}...`,
        'Content-Type': 'application/json'
      });
    }

    // Step 3: List users to verify
    console.log('\n3. Listing all users...');
    try {
      const usersResponse = await axios.get(`${API_URL}/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('✅ Users retrieved');
      console.log('Total users:', usersResponse.data.data.length);
      usersResponse.data.data.forEach(user => {
        console.log(`- ${user.name} (${user.email}) - Role: ${user.role}`);
      });
    } catch (error) {
      console.error('❌ Failed to list users');
      console.error('Error:', error.response?.data);
    }

  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the test
testUserCreation();
