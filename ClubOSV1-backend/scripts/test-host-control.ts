#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

async function testHostControl() {
  const apiKey = process.env.UNIFI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ UNIFI_API_KEY not set in .env file');
    process.exit(1);
  }
  
  console.log('========================================');
  console.log('UniFi Host Control Test');
  console.log('========================================\n');
  
  const headers = {
    'X-API-KEY': apiKey,
    'Content-Type': 'application/json'
  };
  
  try {
    // First, get the hosts
    console.log('📋 Getting hosts...\n');
    const hostsResponse = await fetch('https://api.ui.com/ea/hosts', { headers });
    
    if (!hostsResponse.ok) {
      console.log('Failed to get hosts');
      return;
    }
    
    const hostsData = await hostsResponse.json();
    
    // Find the Bedford host (has our Access devices)
    const bedfordHost = hostsData.data?.find((h: any) => h.name?.includes('Bedford') || h.id?.includes('28704E71C50B'));
    
    if (bedfordHost) {
      console.log(`Found Bedford host: ${bedfordHost.id}`);
      console.log(`Host type: ${bedfordHost.type}`);
      console.log(`Hardware ID: ${bedfordHost.hardwareId}\n`);
      
      // Try to get more details about this host
      console.log('🔍 Testing host-specific endpoints...\n');
      
      const hostEndpoints = [
        `https://api.ui.com/ea/hosts/${bedfordHost.id}`,
        `https://api.ui.com/ea/hosts/${bedfordHost.id}/devices`,
        `https://api.ui.com/ea/hosts/${bedfordHost.id}/access`,
        `https://api.ui.com/ea/hosts/${bedfordHost.id}/doors`,
        `https://api.ui.com/ea/hosts/${bedfordHost.id}/command`,
        `https://api.ui.com/ea/hosts/${bedfordHost.id}/proxy/access/api/v1/developer/doors`
      ];
      
      for (const endpoint of hostEndpoints) {
        try {
          const response = await fetch(endpoint, { headers });
          console.log(`${endpoint}: ${response.status} ${response.statusText}`);
          
          if (response.ok) {
            const data = await response.json();
            console.log('  ✅ Success! Data:', JSON.stringify(data, null, 2).substring(0, 300));
          }
        } catch (error: any) {
          console.log(`${endpoint}: ❌ ${error.message}`);
        }
      }
    }
    
    // Test device-specific control
    console.log('\n\n🚪 Testing device-specific control...\n');
    
    // Bedford Front Door MAC: 28704E80C44F
    const doorDevice = '28704E80C44F';
    
    const deviceEndpoints = [
      { 
        name: 'Device info',
        url: `https://api.ui.com/ea/devices/${doorDevice}`,
        method: 'GET'
      },
      {
        name: 'Device command',
        url: `https://api.ui.com/ea/devices/${doorDevice}/command`,
        method: 'POST',
        body: { command: 'unlock', duration: 5 }
      },
      {
        name: 'Device action',
        url: `https://api.ui.com/ea/devices/${doorDevice}/action`,
        method: 'POST',
        body: { action: 'unlock', params: { duration: 5 } }
      },
      {
        name: 'Device control',
        url: `https://api.ui.com/ea/devices/${doorDevice}/control`,
        method: 'POST',
        body: { type: 'unlock', duration: 5 }
      },
      {
        name: 'Device unlock',
        url: `https://api.ui.com/ea/devices/${doorDevice}/unlock`,
        method: 'POST',
        body: { duration: 5 }
      }
    ];
    
    for (const endpoint of deviceEndpoints) {
      console.log(`Testing: ${endpoint.name}`);
      
      try {
        const options: any = {
          method: endpoint.method,
          headers
        };
        
        if (endpoint.body) {
          options.body = JSON.stringify(endpoint.body);
        }
        
        const response = await fetch(endpoint.url, options);
        console.log(`  Response: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('  ✅ Success!', JSON.stringify(data, null, 2));
        } else if (response.status === 400) {
          const error = await response.text();
          console.log('  ⚠️  Bad request:', error.substring(0, 100));
        }
      } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}`);
      }
    }
    
    // Check sites endpoint for access-specific data
    console.log('\n\n🏢 Testing sites endpoint...\n');
    
    const sitesResponse = await fetch('https://api.ui.com/ea/sites', { headers });
    
    if (sitesResponse.ok) {
      const sitesData = await sitesResponse.json();
      console.log('Sites found:', sitesData.data?.length || 0);
      
      if (sitesData.data?.[0]) {
        const site = sitesData.data[0];
        console.log(`\nSite ID: ${site.siteId}`);
        console.log(`Host ID: ${site.hostId}`);
        
        // Test site-specific endpoints
        const siteEndpoints = [
          `https://api.ui.com/ea/sites/${site.siteId}/access`,
          `https://api.ui.com/ea/sites/${site.siteId}/doors`,
          `https://api.ui.com/ea/sites/${site.siteId}/devices`
        ];
        
        for (const endpoint of siteEndpoints) {
          try {
            const response = await fetch(endpoint, { headers });
            console.log(`${endpoint}: ${response.status} ${response.statusText}`);
          } catch (error: any) {
            console.log(`${endpoint}: ❌ ${error.message}`);
          }
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testHostControl().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});