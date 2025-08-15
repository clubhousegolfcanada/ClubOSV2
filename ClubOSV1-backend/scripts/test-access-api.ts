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

async function testAccessAPI() {
  const accessToken = process.env.UNIFI_ACCESS_API_TOKEN || process.env.UNIFI_API_KEY;
  const consoleId = process.env.UNIFI_CONSOLE_ID || '0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302';
  const useRemoteAccess = process.env.UNIFI_USE_REMOTE_ACCESS === 'true';
  
  if (!accessToken) {
    console.error('❌ UNIFI_ACCESS_API_TOKEN not set in .env file');
    console.log('\nTo get an Access API token:');
    console.log('1. Log into your UniFi controller');
    console.log('2. Go to Applications > Access > Settings > Security > Advanced');
    console.log('3. Generate an Access API token');
    console.log('4. Add it to .env as UNIFI_ACCESS_API_TOKEN');
    process.exit(1);
  }
  
  console.log('========================================');
  console.log('UniFi Access API Test');
  console.log('========================================\n');
  console.log(`Console ID: ${consoleId}`);
  console.log(`API Token: ${accessToken.substring(0, 8)}...${accessToken.substring(accessToken.length - 4)}`);
  console.log(`Using Remote Access: ${useRemoteAccess}\n`);
  
  // Determine base URL based on remote access setting
  let baseUrl;
  if (useRemoteAccess) {
    baseUrl = `https://unifi.ui.com/proxy/consoles/${consoleId}/access`;
    console.log('🌐 Using cloud proxy (Remote Access enabled)\n');
  } else {
    const controllerIp = process.env.UNIFI_CONTROLLER_IP || '192.168.1.1';
    const apiPort = process.env.UNIFI_API_PORT || '12445';
    baseUrl = `https://${controllerIp}:${apiPort}`;
    console.log(`🏠 Using local connection: ${baseUrl}\n`);
  }
  
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
  
  // Test API endpoints
  console.log('📋 Testing Access API endpoints...\n');
  
  const endpoints = [
    { name: 'Doors', path: '/api/v1/developer/doors' },
    { name: 'Door Groups', path: '/api/v1/developer/door_groups' },
    { name: 'Visitors', path: '/api/v1/developer/visitors' },
    { name: 'Access Info', path: '/api/v1/developer/info' },
    { name: 'Devices', path: '/api/v1/developer/devices' }
  ];
  
  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint.path}`;
    console.log(`Testing ${endpoint.name}: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers,
        agent: httpsAgent
      });
      
      console.log(`  Response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('  ✅ Success!');
        
        // Show sample data
        if (data.data && Array.isArray(data.data)) {
          console.log(`  Found ${data.data.length} ${endpoint.name.toLowerCase()}`);
          if (data.data[0]) {
            console.log(`  Sample:`, JSON.stringify(data.data[0], null, 2).substring(0, 200));
          }
        } else {
          console.log(`  Data:`, JSON.stringify(data, null, 2).substring(0, 200));
        }
      } else {
        const errorText = await response.text();
        console.log(`  ❌ Error:`, errorText.substring(0, 100));
      }
    } catch (error: any) {
      console.log(`  ❌ Connection error: ${error.message}`);
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        console.log('  💡 If using remote access, ensure it\'s enabled in UniFi Dashboard > Settings > System > Remote Access');
      }
    }
    console.log();
  }
  
  // If we found doors, test unlock
  console.log('\n🚪 Testing door control...\n');
  
  const doorsUrl = `${baseUrl}/api/v1/developer/doors`;
  
  try {
    const doorsResponse = await fetch(doorsUrl, {
      headers,
      agent: httpsAgent
    });
    
    if (doorsResponse.ok) {
      const doorsData = await doorsResponse.json();
      
      if (doorsData.data && doorsData.data.length > 0) {
        const firstDoor = doorsData.data[0];
        console.log(`Found door: ${firstDoor.name || firstDoor.id}`);
        console.log(`Door ID: ${firstDoor.id}`);
        
        // Test unlock command
        const unlockUrl = `${baseUrl}/api/v1/developer/doors/${firstDoor.id}/unlock`;
        console.log(`\nTesting unlock: ${unlockUrl}`);
        
        const unlockResponse = await fetch(unlockUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            duration: 5
          }),
          agent: httpsAgent
        });
        
        console.log(`Unlock response: ${unlockResponse.status} ${unlockResponse.statusText}`);
        
        if (unlockResponse.ok) {
          const unlockData = await unlockResponse.json();
          console.log('✅ Door unlock successful!');
          console.log('Response:', JSON.stringify(unlockData, null, 2));
        } else {
          const errorText = await unlockResponse.text();
          console.log('❌ Unlock failed:', errorText);
        }
      } else {
        console.log('No doors found in the system');
      }
    } else {
      console.log('Could not retrieve doors list');
    }
  } catch (error: any) {
    console.log(`Error testing door control: ${error.message}`);
  }
}

testAccessAPI().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});