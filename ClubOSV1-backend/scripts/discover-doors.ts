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

async function discoverDoors() {
  const apiKey = process.env.UNIFI_API_KEY;
  const controllerIp = process.env.UNIFI_CONTROLLER_IP || '192.168.1.1';
  const apiPort = process.env.UNIFI_API_PORT || '12445';
  const baseUrl = `https://${controllerIp}:${apiPort}`;
  
  if (!apiKey) {
    console.error('❌ UNIFI_API_KEY not set in .env file');
    process.exit(1);
  }
  
  console.log('========================================');
  console.log('UniFi Access Door Discovery');
  console.log('========================================\n');
  console.log(`API URL: ${baseUrl}`);
  console.log(`API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}\n`);
  
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
  
  try {
    // Try to fetch doors
    console.log('🔍 Fetching doors...');
    const doorsResponse = await fetch(`${baseUrl}/api/v1/developer/doors`, {
      headers,
      agent: httpsAgent
    });
    
    console.log(`Response status: ${doorsResponse.status}`);
    const doorsText = await doorsResponse.text();
    
    if (doorsResponse.ok) {
      const doorsData = JSON.parse(doorsText);
      console.log('\n✅ Doors found:');
      console.log(JSON.stringify(doorsData, null, 2));
      
      // If we have door data, show the structure
      if (doorsData.data && Array.isArray(doorsData.data)) {
        console.log('\n📋 Door Summary:');
        doorsData.data.forEach((door: any) => {
          console.log(`- ${door.name || 'Unnamed'} (ID: ${door.id || door.door_id || door.mac || 'unknown'})`);
        });
      }
    } else {
      console.log(`❌ Failed to fetch doors: ${doorsResponse.statusText}`);
      console.log('Response body:', doorsText);
    }
    
    // Try to fetch door groups
    console.log('\n🔍 Fetching door groups...');
    const groupsResponse = await fetch(`${baseUrl}/api/v1/developer/door_groups`, {
      headers,
      agent: httpsAgent
    });
    
    console.log(`Response status: ${groupsResponse.status}`);
    const groupsText = await groupsResponse.text();
    
    if (groupsResponse.ok) {
      const groupsData = JSON.parse(groupsText);
      console.log('\n✅ Door groups found:');
      console.log(JSON.stringify(groupsData, null, 2));
    } else {
      console.log(`❌ Failed to fetch door groups: ${groupsResponse.statusText}`);
      console.log('Response body:', groupsText);
    }
    
    // Try to fetch visitors (to test API connectivity)
    console.log('\n🔍 Testing API connectivity with visitors endpoint...');
    const visitorsResponse = await fetch(`${baseUrl}/api/v1/developer/visitors`, {
      headers,
      agent: httpsAgent
    });
    
    console.log(`Response status: ${visitorsResponse.status}`);
    if (visitorsResponse.ok) {
      console.log('✅ API connection successful');
    } else {
      console.log('❌ API connection failed');
      const visitorsText = await visitorsResponse.text();
      console.log('Response body:', visitorsText);
    }
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Connection refused. Possible issues:');
      console.log('1. The controller IP is incorrect');
      console.log('2. The API port is incorrect (default is 12445)');
      console.log('3. UniFi Access API is not enabled');
      console.log('4. Firewall is blocking the connection');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('\n💡 Connection timeout. The controller may not be accessible from this network.');
      console.log('Consider using a VPN or Tailscale to connect to the local network.');
    }
  }
}

discoverDoors().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});