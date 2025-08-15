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

async function testAuthFlow() {
  console.log('========================================');
  console.log('UniFi Authentication Flow Test');
  console.log('========================================\n');
  
  // Check if we have credentials
  const username = process.env.UNIFI_CLOUD_USERNAME || process.env.UNIFI_USERNAME;
  const password = process.env.UNIFI_CLOUD_PASSWORD || process.env.UNIFI_PASSWORD;
  const apiKey = process.env.UNIFI_API_KEY;
  
  if (!username || !password) {
    console.log('⚠️  No UniFi credentials found in .env');
    console.log('Add UNIFI_CLOUD_USERNAME and UNIFI_CLOUD_PASSWORD to test cloud authentication\n');
  }
  
  // Test API key capabilities
  if (apiKey) {
    console.log('🔑 Testing API Key capabilities...\n');
    
    // Test what the API key can access
    const endpoints = [
      { name: 'User Info', url: 'https://api.ui.com/users/self' },
      { name: 'Sites', url: 'https://api.ui.com/ea/sites' },
      { name: 'Consoles', url: 'https://api.ui.com/ea/consoles' },
      { name: 'Hosts', url: 'https://api.ui.com/ea/hosts' },
      { name: 'Permissions', url: 'https://api.ui.com/ea/permissions' },
      { name: 'Applications', url: 'https://api.ui.com/ea/applications' }
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json'
          },
          agent: httpsAgent
        });
        
        console.log(`${endpoint.name}: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`  ✅ Accessible`);
          console.log(`  Data:`, JSON.stringify(data, null, 2).substring(0, 200));
        }
      } catch (error: any) {
        console.log(`${endpoint.name}: ❌ ${error.message}`);
      }
    }
  }
  
  // Try cloud login if we have credentials
  if (username && password) {
    console.log('\n\n🔐 Testing UniFi Cloud Login...\n');
    
    try {
      // Step 1: Login to UniFi account
      console.log('Step 1: Logging into UniFi account...');
      const loginResponse = await fetch('https://sso.ui.com/api/sso/v1/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          password,
          rememberMe: true
        }),
        agent: httpsAgent
      });
      
      console.log(`Login response: ${loginResponse.status} ${loginResponse.statusText}`);
      
      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        console.log('✅ Login successful!');
        
        // Extract token
        const token = loginData.token || loginData.access_token || loginData.sessionToken;
        const userId = loginData.userId || loginData.user?.id;
        
        if (token) {
          console.log(`Token received: ${token.substring(0, 20)}...`);
          console.log(`User ID: ${userId}`);
          
          // Step 2: Use token to access UniFi services
          console.log('\nStep 2: Testing authenticated access...');
          
          const authenticatedEndpoints = [
            'https://api.ui.com/ea/devices',
            'https://api.ui.com/ea/hosts',
            'https://unifi.ui.com/api/consoles'
          ];
          
          for (const endpoint of authenticatedEndpoints) {
            try {
              const response = await fetch(endpoint, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                agent: httpsAgent
              });
              
              console.log(`${endpoint}: ${response.status} ${response.statusText}`);
              
              if (response.ok) {
                console.log('  ✅ Access granted with session token');
              }
            } catch (error: any) {
              console.log(`${endpoint}: ❌ ${error.message}`);
            }
          }
          
          // Step 3: Try to access Access-specific endpoints
          console.log('\nStep 3: Testing Access API with session token...');
          const consoleId = '0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302';
          
          const accessEndpoints = [
            `https://unifi.ui.com/proxy/consoles/${consoleId}/access/api/v1/developer/doors`,
            `https://api.ui.com/proxy/consoles/${consoleId}/access/api/auth/login`
          ];
          
          for (const endpoint of accessEndpoints) {
            try {
              const response = await fetch(endpoint, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                agent: httpsAgent
              });
              
              console.log(`${endpoint}: ${response.status} ${response.statusText}`);
              
              if (response.status === 302 || response.status === 301) {
                console.log('  Redirect to:', response.headers.get('location'));
              }
            } catch (error: any) {
              console.log(`${endpoint}: ❌ ${error.message}`);
            }
          }
        }
      } else {
        const errorText = await loginResponse.text();
        console.log('❌ Login failed:', errorText);
      }
    } catch (error: any) {
      console.log('❌ Login error:', error.message);
    }
  }
  
  // Check mobile app endpoints
  console.log('\n\n📱 Testing Mobile App Endpoints...\n');
  
  const mobileEndpoints = [
    { name: 'Mobile API', url: 'https://api.ui.com/api/v1/access/doors' },
    { name: 'Mobile Auth', url: 'https://api.ui.com/auth/sso/verify' },
    { name: 'App Config', url: 'https://api.ui.com/apps/access' }
  ];
  
  for (const endpoint of mobileEndpoints) {
    try {
      const response = await fetch(endpoint.url, {
        headers: apiKey ? {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        } : {},
        agent: httpsAgent
      });
      
      console.log(`${endpoint.name}: ${response.status} ${response.statusText}`);
    } catch (error: any) {
      console.log(`${endpoint.name}: ❌ ${error.message}`);
    }
  }
}

testAuthFlow().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});