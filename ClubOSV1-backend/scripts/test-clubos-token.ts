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

async function testClubOSToken() {
  console.log('🔑 Testing CLUBOSV1TOKEN\n');
  console.log('=' .repeat(50));

  const token = process.env.UNIFI_ACCESS_TOKEN || process.env.UNIFI_DEVELOPER_TOKEN;
  const controllerIP = process.env.UNIFI_CONTROLLER_IP || '192.168.1.1';
  const apiPort = process.env.UNIFI_API_PORT || '12445';

  console.log('📋 Configuration:');
  console.log(`Token: ${token ? '✅ ' + token.substring(0, 10) + '...' : '❌ Not found'}`);
  console.log(`Controller: https://${controllerIP}:${apiPort}`);
  console.log('');

  if (!token) {
    console.log('❌ Token not found in environment!');
    process.exit(1);
  }

  try {
    // Test 1: Try local controller connection
    console.log('🔌 Test 1: Trying local controller connection...');
    const localUrl = `https://${controllerIP}:${apiPort}/api/v1/developer/doors`;
    
    const localResponse = await fetch(localUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      agent: httpsAgent,
      timeout: 5000
    }).catch(err => {
      console.log(`   Local connection failed: ${err.message}`);
      return null;
    });

    if (localResponse && localResponse.ok) {
      const data = await localResponse.json();
      console.log(`   ✅ Local connection successful!`);
      
      if (data.code === 'SUCCESS' && data.data) {
        console.log(`   Found ${data.data.length} doors locally`);
        
        // Display doors
        data.data.forEach((door: any, index: number) => {
          console.log(`\n   Door ${index + 1}:`);
          console.log(`     Name: ${door.name}`);
          console.log(`     ID: ${door.id}`);
          console.log(`     Can Unlock: ${door.is_bind_hub ? '✅' : '❌'}`);
        });
        
        console.log('\n✅ SUCCESS! Your CLUBOSV1TOKEN works with local access!');
        console.log('\n🚀 You can now:');
        console.log('   1. Unlock doors programmatically');
        console.log('   2. Set lock schedules');
        console.log('   3. Manage emergency lockdown');
        return;
      }
    } else if (localResponse) {
      console.log(`   Local auth failed: ${localResponse.status} ${localResponse.statusText}`);
    }

    // Test 2: Try cloud proxy with token
    console.log('\n☁️  Test 2: Trying cloud proxy...');
    const consoleId = process.env.UNIFI_CONSOLE_ID;
    
    if (consoleId) {
      const cloudUrl = `https://unifi.ui.com/proxy/consoles/${consoleId}/access/api/v1/developer/doors`;
      console.log(`   URL: ${cloudUrl}`);
      
      const cloudResponse = await fetch(cloudUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        timeout: 10000
      }).catch(err => {
        console.log(`   Cloud connection failed: ${err.message}`);
        return null;
      });

      if (cloudResponse && cloudResponse.ok) {
        const data = await cloudResponse.json();
        console.log(`   ✅ Cloud proxy successful!`);
        
        if (data.code === 'SUCCESS' && data.data) {
          console.log(`   Found ${data.data.length} doors via cloud`);
          console.log('\n✅ SUCCESS! Your CLUBOSV1TOKEN works with cloud proxy!');
          return;
        }
      } else if (cloudResponse) {
        const text = await cloudResponse.text();
        if (text.includes('login')) {
          console.log('   Cloud proxy requires session authentication (not just token)');
        } else {
          console.log(`   Cloud auth failed: ${cloudResponse.status}`);
        }
      }
    }

    // If we get here, neither worked
    console.log('\n⚠️  Token authentication issues:');
    console.log('');
    console.log('Possible solutions:');
    console.log('1. Make sure you\'re on the same network as the controller');
    console.log('2. Check if the controller IP is correct: ' + controllerIP);
    console.log('3. The token might need more permissions (Device: Edit)');
    console.log('4. Try using a VPN to connect to the controller network');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  }
}

// Run the test
testClubOSToken().catch(console.error);