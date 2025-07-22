#!/bin/bash

echo "🔍 Quick test script for feedback API..."
echo ""
echo "Run these commands in your browser console:"
echo ""
cat << 'EOF'
// 1. Check environment and token
console.log('=== Environment Check ===');
console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
console.log('Token exists:', !!localStorage.getItem('clubos_token'));

// 2. Test with fetch (works)
console.log('\n=== Testing with fetch ===');
fetch('https://clubosv2-production.up.railway.app/api/feedback', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('clubos_token')
  },
  body: JSON.stringify({
    timestamp: new Date().toISOString(),
    requestDescription: 'Test via fetch',
    location: 'Test',
    route: 'Auto',
    response: 'Test',
    confidence: 0.8,
    isUseful: false,
    feedbackType: 'not_useful'
  })
}).then(r => r.json()).then(d => console.log('Fetch success:', d)).catch(e => console.error('Fetch error:', e));

// 3. Test with axios (might fail)
console.log('\n=== Testing with axios ===');
axios.post('https://clubosv2-production.up.railway.app/api/feedback', {
  timestamp: new Date().toISOString(),
  requestDescription: 'Test via axios',
  location: 'Test',
  route: 'Auto',
  response: 'Test',
  confidence: 0.8,
  isUseful: false,
  feedbackType: 'not_useful'
}, {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('clubos_token'),
    'Content-Type': 'application/json'
  }
}).then(r => console.log('Axios success:', r.data)).catch(e => {
  console.error('Axios error:', e);
  console.log('Error response:', e.response?.data);
  console.log('Error config:', e.config);
});
EOF
