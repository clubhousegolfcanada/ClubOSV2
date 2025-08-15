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

async function testCloudAPI() {
  const apiKey = process.env.UNIFI_API_KEY;
  const consoleId = '0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302';
  
  if (!apiKey) {
    console.error('❌ UNIFI_API_KEY not set in .env file');
    process.exit(1);
  }
  
  console.log('========================================');
  console.log('UniFi Cloud API Test');
  console.log('========================================\n');
  console.log(`API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}\n`);
  
  // Different endpoint patterns to try
  const endpoints = [
    // UniFi UI Cloud endpoints
    `https://api.ui.com/ea/devices`,
    `https://api.ui.com/ea/doors`,
    `https://unifi.ui.com/proxy/consoles/${consoleId}/access/api/v2/devices/topology4`,
    `https://unifi.ui.com/proxy/consoles/${consoleId}/access/api/v1/developer/doors`,
    
    // Network API endpoints
    `https://api.ui.com/ea/networks/${consoleId}/devices`,
    `https://api.ui.com/v1/developer/doors`,
    
    // Direct Access API
    `https://api.ui.com/access/v1/doors`,
    `https://api.ui.com/access/api/v1/developer/doors`
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\n🔍 Testing: ${endpoint}`);
    
    try {
      // Try with X-API-KEY header
      console.log('  Using X-API-KEY header...');
      let response = await fetch(endpoint, {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        agent: httpsAgent
      });
      
      console.log(`  Response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('  ✅ SUCCESS with X-API-KEY!');
        console.log('  Data:', JSON.stringify(data, null, 2).substring(0, 200));
        continue;
      }
      
      // Try with Bearer token
      console.log('  Using Bearer token...');
      response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        agent: httpsAgent
      });
      
      console.log(`  Response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('  ✅ SUCCESS with Bearer token!');
        console.log('  Data:', JSON.stringify(data, null, 2).substring(0, 200));
      } else {
        const text = await response.text();
        console.log('  ❌ Failed:', text.substring(0, 100));
      }
      
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  // Test UniFi Identity API
  console.log('\n\n🔍 Testing UniFi Identity API...');
  try {
    const response = await fetch('https://api.ui.com/v1/developer/devices', {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Identity API Success!');
      console.log('Data:', JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('❌ Failed:', text);
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testCloudAPI().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});