#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

const CONSOLE_ID = '0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302';

console.log('========================================');
console.log('UniFi Network Console Test');
console.log('========================================\n');

console.log('Console ID:', CONSOLE_ID);
console.log('Network Dashboard: https://unifi.ui.com/consoles/' + CONSOLE_ID + '/network/default/dashboard');
console.log('Checking for Access capabilities...\n');

// Check if credentials are configured
const username = process.env.UNIFI_CLOUD_USERNAME || process.env.UNIFI_USERNAME;
const password = process.env.UNIFI_CLOUD_PASSWORD || process.env.UNIFI_PASSWORD;

if (!username || !password) {
  console.log('⚠️  Credentials not configured!\n');
  console.log('Add these to your .env file:');
  console.log('UNIFI_CLOUD_USERNAME=your-ubiquiti-email@example.com');
  console.log('UNIFI_CLOUD_PASSWORD=your-password');
  console.log('UNIFI_CONSOLE_ID=' + CONSOLE_ID);
  process.exit(1);
}

console.log('✅ Credentials found for:', username);
console.log('Testing UniFi console access...\n');

async function testUniFiAccess() {
  try {
    // Step 1: Authenticate with UniFi Cloud
    console.log('1. Authenticating with UniFi Cloud...');
    const authResponse = await fetch('https://unifi.ui.com/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password })
    });

    if (!authResponse.ok) {
      const error = await authResponse.text();
      throw new Error(`Authentication failed: ${authResponse.status} - ${error}`);
    }

    // Get cookies from response
    const cookies = authResponse.headers.get('set-cookie') || '';
    console.log('   ✅ Cloud authentication successful\n');

    // Step 2: Check what's available in this console
    console.log('2. Checking console capabilities...\n');

    // Test different endpoints
    const endpoints = [
      { 
        name: 'Network API', 
        url: `/network/default/api/s/default/stat/device` 
      },
      { 
        name: 'Access API (if available)', 
        url: `/access/api/v1/info` 
      },
      { 
        name: 'Access Doors', 
        url: `/access/api/v1/developer/doors` 
      },
      { 
        name: 'Network Devices', 
        url: `/network/api/s/default/stat/device` 
      },
      { 
        name: 'Client Devices', 
        url: `/network/api/s/default/stat/sta` 
      }
    ];

    console.log('   Testing endpoints:');
    for (const endpoint of endpoints) {
      const url = `https://unifi.ui.com/proxy/consoles/${CONSOLE_ID}${endpoint.url}`;
      try {
        const response = await fetch(url, {
          headers: {
            'Cookie': cookies,
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`   ✅ ${endpoint.name}: Available`);
          
          // If we found devices, check for Access devices
          if (endpoint.name === 'Network Devices' && data.data) {
            const devices = Array.isArray(data.data) ? data.data : [data.data];
            const accessDevices = devices.filter((d: any) => 
              d.type === 'uah' || // UniFi Access Hub
              d.type === 'ualite' || // UniFi Access Lite
              d.model?.toLowerCase().includes('access') ||
              d.name?.toLowerCase().includes('door')
            );
            
            if (accessDevices.length > 0) {
              console.log(`\n   🚪 Found ${accessDevices.length} Access devices!`);
              accessDevices.forEach((device: any) => {
                console.log(`      - ${device.name || device.mac} (${device.model || device.type})`);
                console.log(`        MAC: ${device.mac}`);
                console.log(`        IP: ${device.ip || 'N/A'}`);
              });
              console.log('');
            }
          }
        } else {
          console.log(`   ❌ ${endpoint.name}: Not available (${response.status})`);
        }
      } catch (error: any) {
        console.log(`   ❌ ${endpoint.name}: Error - ${error.message}`);
      }
    }

    // Step 3: Look for UniFi Access in applications
    console.log('\n3. Checking for UniFi Access application...');
    const appsUrl = `https://unifi.ui.com/proxy/consoles/${CONSOLE_ID}/applications`;
    
    try {
      const appsResponse = await fetch(appsUrl, {
        headers: {
          'Cookie': cookies,
          'Accept': 'application/json'
        }
      });

      if (appsResponse.ok) {
        const apps = await appsResponse.json();
        console.log('   Available applications:', apps);
      } else {
        console.log('   Could not list applications');
      }
    } catch (error) {
      console.log('   Applications endpoint not available');
    }

    // Step 4: Check if we need to switch to a different approach
    console.log('\n========================================');
    console.log('Analysis Results');
    console.log('========================================\n');

    console.log('This appears to be a UniFi Network console.');
    console.log('\nOptions for door control:\n');
    
    console.log('1. UniFi Access might be integrated into Network console');
    console.log('   - Look for Access devices in your device list');
    console.log('   - Check under Settings > System > Advanced Features\n');
    
    console.log('2. You might need a separate UniFi Access application');
    console.log('   - Check if Access is available at: https://unifi.ui.com');
    console.log('   - It might be under a different console\n');
    
    console.log('3. Use direct connection to local controllers');
    console.log('   - If Access controllers are on-site');
    console.log('   - Would require VPN or port forwarding\n');

    console.log('Next steps:');
    console.log('1. Check your UniFi dashboard for Access devices');
    console.log('2. Look for door/access controllers in device list');
    console.log('3. If found, note their MAC addresses for configuration');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('Authentication failed')) {
      console.log('\nTroubleshooting:');
      console.log('1. Verify your Ubiquiti account credentials');
      console.log('2. Try logging in at https://unifi.ui.com');
      console.log('3. Check if 2FA is enabled');
    }
  }
}

// Run the test
testUniFiAccess().catch(console.error);