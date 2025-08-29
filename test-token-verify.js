// Test token verification
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env' });

// The token from the logs (partial)
const tokenPreview = 'eyJhbGciOiJIU';

console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0);

// Try to create a test token with current secret
try {
  const testPayload = {
    userId: 'test-id',
    email: 'test@test.com',
    role: 'admin',
    sessionId: 'test-session'
  };
  
  const testToken = jwt.sign(testPayload, process.env.JWT_SECRET, {
    expiresIn: '4h',
    issuer: 'clubosv1',
    audience: 'clubosv1-users'
  });
  
  console.log('Test token created successfully');
  console.log('Token preview:', testToken.substring(0, 20) + '...');
  
  // Try to verify it
  const decoded = jwt.verify(testToken, process.env.JWT_SECRET, {
    issuer: 'clubosv1',
    audience: 'clubosv1-users'
  });
  
  console.log('Token verified successfully:', decoded);
} catch (error) {
  console.error('Token creation/verification failed:', error.message);
}
