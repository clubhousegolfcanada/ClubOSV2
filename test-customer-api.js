const axios = require('axios');

const API_URL = 'http://localhost:5005/api/v2/customer';

async function testCustomerAPI() {
  console.log('Testing Clubhouse Customer API...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_URL}/health`);
    console.log('✅ Health check:', healthResponse.data);
    console.log('');

    // Test registration
    console.log('2. Testing registration...');
    const registerData = {
      email: `test${Date.now()}@clubhouse247golf.com`,
      password: 'TestPassword123!',
      name: 'Test Customer',
      phone: '+1234567890'
    };
    
    const registerResponse = await axios.post(`${API_URL}/auth/register`, registerData);
    console.log('✅ Registration successful:', {
      user: registerResponse.data.user,
      hasAccessToken: !!registerResponse.data.accessToken,
      hasRefreshToken: !!registerResponse.data.refreshToken
    });
    console.log('');

    const { accessToken, refreshToken } = registerResponse.data;

    // Test login
    console.log('3. Testing login...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: registerData.email,
      password: registerData.password
    });
    console.log('✅ Login successful:', {
      user: loginResponse.data.user,
      hasTokens: !!loginResponse.data.accessToken
    });
    console.log('');

    // Test authenticated endpoint
    console.log('4. Testing authenticated profile endpoint...');
    const profileResponse = await axios.get(`${API_URL}/profile`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    console.log('✅ Profile retrieved:', profileResponse.data);
    console.log('');

    console.log('🎉 All tests passed! Clubhouse Customer API is working.');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    console.error('URL:', error.config?.url);
  }
}

// Start the server first, then run tests after a delay
console.log('Make sure the backend server is running on port 5005...');
setTimeout(testCustomerAPI, 2000);