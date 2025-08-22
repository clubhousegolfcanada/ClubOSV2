const axios = require('axios');

async function testProfileAPI() {
  const API_URL = 'http://localhost:5005';
  
  try {
    console.log('Testing Customer Profile API...\n');
    
    // First, let's login as Mike (customer)
    console.log('1. Logging in as customer...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'mikebelair79@gmail.com',
      password: 'Test1234!'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful, token received\n');
    
    // Get current profile
    console.log('2. Fetching current profile...');
    const profileResponse = await axios.get(`${API_URL}/api/customer-profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('Current profile data:');
    console.log(JSON.stringify(profileResponse.data.data, null, 2));
    console.log();
    
    // Update profile with location
    console.log('3. Updating profile with location...');
    const updateData = {
      homeLocation: 'Bedford',
      bio: 'Golf enthusiast and founding member',
      handicap: 15.5,
      preferredTeeTime: 'morning',
      preferredBayType: 'trackman'
    };
    
    const updateResponse = await axios.put(`${API_URL}/api/customer-profile`, 
      updateData,
      { headers: { Authorization: `Bearer ${token}` }}
    );
    
    console.log('✅ Profile updated successfully');
    console.log();
    
    // Fetch updated profile
    console.log('4. Fetching updated profile...');
    const updatedProfileResponse = await axios.get(`${API_URL}/api/customer-profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('Updated profile data:');
    console.log(JSON.stringify(updatedProfileResponse.data.data, null, 2));
    
    // Test the /api/auth/profile endpoint too
    console.log('\n5. Testing /api/auth/profile endpoint...');
    const authProfileUpdate = await axios.put(`${API_URL}/api/auth/profile`,
      {
        name: 'Mike Belair',
        phone: '902-555-0001',
        location: 'Bedford',
        bio: 'Golf enthusiast and founding member',
        handicap: 15.5
      },
      { headers: { Authorization: `Bearer ${token}` }}
    );
    
    console.log('✅ Auth profile updated:', authProfileUpdate.data.message);
    
    console.log('\n✅ All profile API tests passed!');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.log('\nNote: The test user might not exist or password might be incorrect.');
      console.log('You can create a test customer account or update the credentials in this script.');
    }
  }
}

testProfileAPI();