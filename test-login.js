#!/usr/bin/env node

const axios = require('axios');

async function testLogin() {
  console.log('🧪 Testing ClubOSV1 Login\n');
  
  const API_URL = 'http://localhost:3001/api';
  
  // Test credentials
  const credentials = [
    { email: 'admin@clubhouse247golf.com', password: 'ClubhouseAdmin123!' },
    { email: 'admin@clubhouse247golf.com', password: 'Admin123!' },
    { email: 'admin@clubhouse247golf.com', password: 'Test123!@#' }
  ];
  
  // First check if server is running
  try {
    console.log('1️⃣ Checking if server is running...');
    const health = await axios.get('http://localhost:3001/health');
    console.log('✅ Server is running:', health.data);
    console.log('');
  } catch (error) {
    console.error('❌ Server is not running!');
    console.error('Please start the backend server first:');
    console.error('cd ClubOSV1-backend && npm run dev');
    return;
  }
  
  // Try each credential
  for (const cred of credentials) {
    console.log(`\n2️⃣ Testing login with:`);
    console.log(`   Email: ${cred.email}`);
    console.log(`   Password: ${cred.password}`);
    
    try {
      const response = await axios.post(`${API_URL}/auth/login`, cred);
      
      if (response.data.success) {
        console.log('✅ LOGIN SUCCESSFUL!');
        console.log('   User:', response.data.data.user);
        console.log('   Token:', response.data.data.token.substring(0, 50) + '...');
        console.log('\n🎉 Use these credentials to login!');
        return;
      }
    } catch (error) {
      console.log('❌ Login failed:', error.response?.data?.message || error.message);
    }
  }
  
  console.log('\n❌ None of the credentials worked!');
  console.log('Run the password reset script: node reset-admin-password.js');
}

// Run the test
testLogin();
