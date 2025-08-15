#!/usr/bin/env npx tsx
import fetch from 'node-fetch';
import https from 'https';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Ignore self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

async function testUnifiOSAPI() {
  console.log('🔑 Testing UniFi OS API Access\n');
  console.log('=' .repeat(50));

  const locations = [
    {
      name: 'Bedford',
      token: process.env.BEDFORD_ACCESS_TOKEN || '',
      ip: process.env.BEDFORD_CONTROLLER_IP || '192.168.2.212',
      port: process.env.BEDFORD_API_PORT || '12445'
    },
    {
      name: 'Dartmouth',
      token: process.env.DARTMOUTH_ACCESS_TOKEN || '',
      ip: process.env.DARTMOUTH_CONTROLLER_IP || '192.168.2.103',
      port: process.env.DARTMOUTH_API_PORT || '12445'
    }
  ];

  for (const location of locations) {
    console.log(`\n📍 Testing ${location.name}...`);
    console.log(`   IP: ${location.ip}:${location.port}`);
    console.log(`   Token: ${location.token.substring(0, 10)}...`);

    // Try different API paths since it's UniFi OS
    const paths = [
      '/proxy/access/api/v1/developer/doors',  // UniFi OS proxy path
      '/api/access/v1/developer/doors',        // Alternative path
      '/network/default/access/api/v1/developer/doors', // Full path
      '/api/v1/developer/doors'                // Direct path (what we've been trying)
    ];

    let found = false;
    
    for (const apiPath of paths) {
      if (found) break;
      
      const url = `https://${location.ip}:${location.port}${apiPath}`;
      console.log(`   Trying: ${apiPath}`);
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${location.token}`,
            'Accept': 'application/json'
          },
          agent: httpsAgent,
          timeout: 5000
        });

        if (response.ok) {
          const data = await response.json();
          if (data.code === 'SUCCESS' && data.data) {
            console.log(`   ✅ SUCCESS! Found working path: ${apiPath}`);
            console.log(`   Found ${data.data.length} door(s)`);
            found = true;
            
            // Show doors
            data.data.forEach((door: any, index: number) => {
              console.log(`      ${index + 1}. ${door.name || door.full_name}`);
            });
          }
        } else if (response.status === 401) {
          console.log(`      Auth failed (401)`);
        } else if (response.status === 404) {
          console.log(`      Not found (404)`);
        } else {
          console.log(`      Status: ${response.status}`);
        }
      } catch (error: any) {
        if (error.message.includes('timeout')) {
          console.log(`      Timeout`);
        } else {
          console.log(`      Error: ${error.message.substring(0, 30)}`);
        }
      }
    }
    
    if (!found) {
      console.log('   ❌ No working API path found');
      console.log('\n   Possible issues:');
      console.log('   1. The API might be at /proxy/network/[site-id]/access/api/v1/developer/doors');
      console.log('   2. The token might need to be in a cookie instead of Authorization header');
      console.log('   3. UniFi OS might require session authentication first');
    }
  }
}

// Run the test
testUnifiOSAPI().catch(console.error);