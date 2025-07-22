// Quick script to check authentication status
console.log('Checking authentication status...');

// Check localStorage
const token = localStorage.getItem('clubos_token');
const user = localStorage.getItem('clubos_user');

console.log('Token exists:', !!token);
console.log('User data:', user ? JSON.parse(user) : null);

if (token) {
  console.log('Token (first 20 chars):', token.substring(0, 20) + '...');
  
  // Try to decode the token (if it's a JWT)
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      console.log('Token payload:', payload);
      console.log('Token expires:', new Date(payload.exp * 1000));
      console.log('Is expired:', new Date(payload.exp * 1000) < new Date());
    }
  } catch (e) {
    console.log('Could not decode token');
  }
} else {
  console.log('No token found - you need to log in!');
}

// Check session storage
const redirect = sessionStorage.getItem('redirectAfterLogin');
console.log('Redirect after login:', redirect);
