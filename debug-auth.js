// Debug script for 401 errors
console.log('=== ClubOS Authentication Debug ===');

// 1. Check token
const token = localStorage.getItem('clubos_token');
console.log('Token exists:', !!token);

if (token) {
  // Decode token
  try {
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    console.log('Token payload:', payload);
    const expDate = new Date(payload.exp * 1000);
    console.log('Token expires:', expDate);
    console.log('Is expired:', expDate < new Date());
    console.log('Time until expiry:', Math.floor((expDate - new Date()) / 1000 / 60), 'minutes');
  } catch (e) {
    console.error('Error decoding token:', e);
  }
  
  // Test API call
  console.log('\n=== Testing API Call ===');
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/slack/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  })
  .then(r => {
    console.log('Test response status:', r.status);
    return r.json();
  })
  .then(data => console.log('Test response:', data))
  .catch(err => console.error('Test error:', err));
  
} else {
  console.error('NO TOKEN FOUND - Please log in!');
}

// 2. Check user data
const userData = localStorage.getItem('clubos_user');
if (userData) {
  console.log('\nUser data:', JSON.parse(userData));
} else {
  console.log('\nNo user data found');
}

// 3. Check API URL
console.log('\nAPI URL:', process.env.NEXT_PUBLIC_API_URL || 'Not set - using default');
