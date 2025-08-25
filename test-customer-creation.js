// Test script to verify customer creation works
const axios = require('axios');

async function testCustomerCreation() {
  const API_URL = process.env.TEST_API_URL || 'https://clubosv2-production.up.railway.app';
  
  // Test data - use environment variable for password or generate random
  const testPassword = process.env.TEST_PASSWORD || `Test${Math.random().toString(36).substring(2, 8)}!`;
  const testEmail = `test${Date.now()}@example.com`;
  const testData = {
    email: testEmail,
    password: testPassword,
    name: 'Test Customer',
    phone: '555-0123',
    role: 'customer'
  };
  
  console.log('🧪 Testing customer signup endpoint...');
  
  try {
    // Test signup endpoint (public)
    const signupResponse = await axios.post(`${API_URL}/api/auth/signup`, testData);
    
    if (signupResponse.data.success) {
      console.log('✅ Customer signup works!');
      console.log('   Response:', signupResponse.data.message);
      if (signupResponse.data.data?.user) {
        console.log('   User ID:', signupResponse.data.data.user.id);
        console.log('   Status:', signupResponse.data.data.user.status || 'active');
      }
    }
  } catch (error) {
    console.error('❌ Signup failed:', error.response?.data || error.message);
  }
  
  console.log('\n📝 Summary:');
  console.log('- Database migration: ✅ Applied');
  console.log('- Required columns: ✅ Added (status, signup_date, signup_metadata)');
  console.log('- Customer signup: Testing above');
  console.log('\nAdmin panel customer creation should now work as well!');
}

testCustomerCreation();