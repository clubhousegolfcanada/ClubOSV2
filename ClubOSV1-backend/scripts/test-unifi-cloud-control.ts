#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import https from 'https';

// Load environment variables
dotenv.config();

// Create HTTPS agent for self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

async function testCloudControl() {
  const apiKey = process.env.UNIFI_API_KEY;
  const consoleId = '0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302';
  
  if (!apiKey) {
    console.error('❌ UNIFI_API_KEY not set in .env file');
    process.exit(1);
  }
  
  console.log('========================================');
  console.log('UniFi Cloud Door Control Test');
  console.log('========================================\n');
  console.log(`Console ID: ${consoleId}`);
  console.log(`API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}\n`);
  
  // The door MACs we know are correct
  const doors = {
    'Bedford Front': '28:70:4e:80:c4:4f',
    'Bedford Middle': '28:70:4e:80:de:f3',
    'Dartmouth Staff': '28:70:4e:80:de:3b'
  };
  
  // Try different API endpoint patterns that might work with cloud access
  const endpointPatterns = [
    // Direct cloud control endpoints
    {
      name: 'UniFi Cloud Proxy with Console ID',
      url: `https://api.ui.com/proxy/consoles/${consoleId}/access/api/v1/developer/doors/{doorId}/unlock`,
      method: 'POST',
      body: { duration: 5 }
    },
    {
      name: 'UniFi Cloud EA with device control',
      url: `https://api.ui.com/ea/hosts/${consoleId}/devices/{doorId}/unlock`,
      method: 'POST',
      body: { duration: 5 }
    },
    {
      name: 'UniFi Cloud direct device command',
      url: `https://api.ui.com/ea/devices/{doorId}/command`,
      method: 'POST',
      body: { command: 'unlock', duration: 5 }
    },
    {
      name: 'UniFi OS Cloud API v2',
      url: `https://api.ui.com/v2/consoles/${consoleId}/devices/{doorId}/unlock`,
      method: 'POST',
      body: { duration: 5 }
    },
    {
      name: 'UniFi Access Cloud API',
      url: `https://api.ui.com/access/consoles/${consoleId}/doors/{doorId}/unlock`,
      method: 'POST',
      body: { duration: 5 }
    }
  ];
  
  // Test with Bedford Front Door MAC
  const testDoorMac = doors['Bedford Front'];
  const testDoorId = testDoorMac.replace(/:/g, '').toUpperCase();
  
  console.log(`Testing with Bedford Front Door: ${testDoorMac}\n`);
  
  for (const pattern of endpointPatterns) {
    const url = pattern.url.replace('{doorId}', testDoorId);
    console.log(`\n🔍 Testing: ${pattern.name}`);
    console.log(`   URL: ${url}`);
    
    try {
      // Try with X-API-KEY header
      console.log('   Trying X-API-KEY...');
      let response = await fetch(url, {
        method: pattern.method,
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pattern.body),
        agent: httpsAgent
      });
      
      console.log(`   Response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('   ✅ SUCCESS! Door unlock command accepted');
        console.log('   Response:', JSON.stringify(data, null, 2));
        return; // Exit on first success
      }
      
      // Try with Bearer token
      console.log('   Trying Bearer token...');
      response = await fetch(url, {
        method: pattern.method,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pattern.body),
        agent: httpsAgent
      });
      
      console.log(`   Response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('   ✅ SUCCESS! Door unlock command accepted');
        console.log('   Response:', JSON.stringify(data, null, 2));
        return; // Exit on first success
      }
      
      // If we get a 404, the endpoint doesn't exist
      // If we get 401/403, authentication is the issue
      // If we get 400, the request format might be wrong
      if (response.status === 400) {
        const errorText = await response.text();
        console.log('   ⚠️  Bad request - might need different parameters:', errorText.substring(0, 100));
      }
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Test getting door status first (read operation)
  console.log('\n\n📋 Testing door status endpoints (read operations)...\n');
  
  const statusEndpoints = [
    `https://api.ui.com/proxy/consoles/${consoleId}/access/api/v1/developer/doors`,
    `https://api.ui.com/ea/hosts/${consoleId}/devices`,
    `https://api.ui.com/access/consoles/${consoleId}/doors`
  ];
  
  for (const endpoint of statusEndpoints) {
    console.log(`Testing: ${endpoint}`);
    
    try {
      const response = await fetch(endpoint, {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        agent: httpsAgent
      });
      
      console.log(`Response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Can read door data from this endpoint');
        console.log('Sample data:', JSON.stringify(data, null, 2).substring(0, 300));
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

testCloudControl().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});