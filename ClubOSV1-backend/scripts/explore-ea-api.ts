#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

async function exploreEAAPI() {
  const apiKey = process.env.UNIFI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ UNIFI_API_KEY not set in .env file');
    process.exit(1);
  }
  
  console.log('========================================');
  console.log('UniFi EA API Exploration');
  console.log('========================================\n');
  
  const headers = {
    'X-API-KEY': apiKey,
    'Content-Type': 'application/json'
  };
  
  try {
    // Get devices
    console.log('📋 Fetching devices...\n');
    const devicesResponse = await fetch('https://api.ui.com/ea/devices', { headers });
    
    if (devicesResponse.ok) {
      const devicesData = await devicesResponse.json();
      console.log('Devices found:', JSON.stringify(devicesData, null, 2));
      
      // Look for Access devices
      if (devicesData.data) {
        for (const host of devicesData.data) {
          console.log(`\n🏢 Host: ${host.hostName} (${host.hostId})`);
          
          if (host.devices) {
            for (const device of host.devices) {
              console.log(`  📱 Device: ${device.name || device.model || 'Unknown'}`);
              console.log(`     Type: ${device.type || 'Unknown'}`);
              console.log(`     Model: ${device.model || 'Unknown'}`);
              console.log(`     ID: ${device.id || device.mac || 'Unknown'}`);
              
              // Check if it's an Access device
              if (device.model?.includes('UA') || device.type?.includes('access') || device.type?.includes('door')) {
                console.log(`     ✨ This is an Access device!`);
                console.log(`     Full details:`, JSON.stringify(device, null, 2));
              }
            }
          }
        }
      }
    } else {
      console.log('❌ Failed to fetch devices');
    }
    
    // Try to get hosts directly
    console.log('\n\n📋 Fetching hosts...\n');
    const hostsResponse = await fetch('https://api.ui.com/ea/hosts', { headers });
    
    if (hostsResponse.ok) {
      const hostsData = await hostsResponse.json();
      console.log('Hosts:', JSON.stringify(hostsData, null, 2));
    } else {
      console.log(`Hosts endpoint: ${hostsResponse.status} ${hostsResponse.statusText}`);
    }
    
    // Try common EA endpoints
    const endpoints = [
      'https://api.ui.com/ea/consoles',
      'https://api.ui.com/ea/sites',
      'https://api.ui.com/ea/networks',
      'https://api.ui.com/ea/access',
      'https://api.ui.com/ea/doors',
      'https://api.ui.com/ea/locks',
      'https://api.ui.com/ea/readers'
    ];
    
    console.log('\n\n📋 Testing other endpoints...\n');
    for (const endpoint of endpoints) {
      const response = await fetch(endpoint, { headers });
      console.log(`${endpoint}: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('  Data:', JSON.stringify(data, null, 2).substring(0, 200));
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

exploreEAAPI().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});