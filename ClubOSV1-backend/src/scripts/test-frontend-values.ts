// Quick test to see what the frontend is sending
async function testFrontendRequest() {
  const API_URL = 'http://localhost:3001/api';
  
  // Test the direct endpoint to see raw values
  const response = await fetch(`${API_URL}/llm/test-direct`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requestDescription: 'Test request',
      location: 'Test location',
      smartAssistEnabled: true,
      routePreference: 'Auto'
    })
  });
  
  const data = await response.json();
  console.log('Test endpoint response:', JSON.stringify(data, null, 2));
}

console.log('Testing what values are being received...\n');
testFrontendRequest().catch(console.error);

// Also test from browser console
console.log('\nTo test from browser console, run:');
console.log(`
fetch('http://localhost:3001/api/llm/test-direct', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    smartAssistEnabled: true,
    requestDescription: 'Test'
  })
}).then(r => r.json()).then(console.log);
`);
