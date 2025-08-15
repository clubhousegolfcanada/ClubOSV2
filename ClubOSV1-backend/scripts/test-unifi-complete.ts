#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import the API service AFTER env is loaded
import unifiOfficialAPI from '../src/services/unifiOfficialAPI';

async function testEAAPI() {
  console.log('\n📡 Testing EA API (Monitoring Only)...');
  
  const apiKey = process.env.UNIFI_API_KEY || process.env.UNIFI_ACCESS_API_TOKEN;
  if (!apiKey) {
    console.log('❌ No API key found');
    return false;
  }

  try {
    // Test devices endpoint
    const response = await fetch('https://api.ui.com/ea/devices', {
      headers: {
        'X-API-KEY': apiKey,
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const devices = await response.json();
      console.log(`✅ EA API Working - Found ${devices.length || 0} devices`);
      
      // Look for door devices
      const doors = devices.filter((d: any) => 
        d.type === 'uah-door' || 
        d.model?.includes('door') || 
        d.name?.toLowerCase().includes('door')
      );
      
      if (doors.length > 0) {
        console.log(`   Found ${doors.length} door device(s):`);
        doors.slice(0, 3).forEach((door: any) => {
          console.log(`   - ${door.name || door.alias || door.mac}`);
        });
      }
      
      return true;
    } else {
      console.log(`❌ EA API Failed: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error: any) {
    console.log(`❌ EA API Error: ${error.message}`);
    return false;
  }
}

async function testCloudProxy() {
  console.log('\n☁️  Testing Cloud Proxy Access...');
  
  const consoleId = process.env.UNIFI_CONSOLE_ID;
  const apiToken = process.env.UNIFI_ACCESS_API_TOKEN || process.env.UNIFI_API_KEY;
  
  if (!consoleId) {
    console.log('❌ No console ID configured');
    return false;
  }

  const baseUrl = `https://unifi.ui.com/proxy/consoles/${consoleId}/access`;
  
  try {
    const response = await fetch(`${baseUrl}/api/v1/developer/doors`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      console.log('✅ Cloud Proxy Working - Can access Developer API');
      return true;
    } else if (response.status === 401) {
      console.log('❌ Cloud Proxy: Authentication failed (need proper token)');
    } else if (response.status === 404) {
      console.log('❌ Cloud Proxy: API endpoint not found (Remote Access may be disabled)');
    } else {
      console.log(`❌ Cloud Proxy Failed: ${response.status} ${response.statusText}`);
    }
    return false;
  } catch (error: any) {
    console.log(`❌ Cloud Proxy Error: ${error.message}`);
    return false;
  }
}

async function testOfficialAPI() {
  console.log('\n🔧 Testing Official API Service...');
  
  try {
    // Get API status
    const status = unifiOfficialAPI.getApiStatus();
    console.log('API Status:');
    console.log(`  Configured: ${status.configured ? '✅' : '❌'}`);
    console.log(`  Can Control: ${status.canControl ? '✅' : '❌'}`);
    console.log(`  Mode: ${status.mode}`);
    console.log(`  Base URL: ${status.baseUrl}`);
    console.log('');

    // Try to fetch doors
    console.log('Fetching doors...');
    const doors = await unifiOfficialAPI.fetchAllDoors();
    
    if (doors && doors.length > 0) {
      console.log(`✅ Found ${doors.length} door(s):`);
      
      doors.forEach((door, index) => {
        console.log(`\nDoor ${index + 1}:`);
        console.log(`  Name: ${door.name}`);
        console.log(`  Full Name: ${door.full_name}`);
        console.log(`  ID: ${door.id}`);
        console.log(`  Can Unlock: ${door.is_bind_hub ? '✅' : '❌'}`);
        console.log(`  Status: ${door.door_lock_relay_status === 'lock' ? '🔒 Locked' : '🔓 Unlocked'}`);
      });

      // Check if we can control doors
      if (status.canControl) {
        console.log('\n🎉 Door control is available!');
        console.log('You can unlock doors using:');
        console.log('  npm run unlock:door');
      } else {
        console.log('\n⚠️  Door monitoring only (no control)');
        console.log('To enable door control, you need:');
        console.log('  1. Developer API token from UniFi Access');
        console.log('  2. Or enable Remote Access on your controller');
        console.log('  3. Or use VPN/Tailscale for local access');
      }
      
      return true;
    } else {
      console.log('⚠️  No doors found');
      return false;
    }
  } catch (error: any) {
    console.log(`❌ API Error: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('=' .repeat(50));
  console.log('UniFi Access Complete API Test');
  console.log('=' .repeat(50));

  console.log('\n📋 Configuration:');
  console.log(`API Key: ${process.env.UNIFI_API_KEY || process.env.UNIFI_ACCESS_API_TOKEN ? '✅' : '❌'}`);
  console.log(`Console ID: ${process.env.UNIFI_CONSOLE_ID || 'Not set'}`);
  console.log(`Remote Access: ${process.env.UNIFI_USE_REMOTE_ACCESS === 'true' ? 'Enabled' : 'Disabled'}`);
  console.log(`Local Controller IP: ${process.env.UNIFI_CONTROLLER_IP || process.env.BEDFORD_CONTROLLER_IP || 'Not set'}`);

  // Run tests
  const eaWorking = await testEAAPI();
  const cloudWorking = await testCloudProxy();
  const apiWorking = await testOfficialAPI();

  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('Test Summary:');
  console.log('=' .repeat(50));
  console.log(`EA API (Monitoring): ${eaWorking ? '✅ Working' : '❌ Failed'}`);
  console.log(`Cloud Proxy (Control): ${cloudWorking ? '✅ Working' : '❌ Failed'}`);
  console.log(`Official API Service: ${apiWorking ? '✅ Working' : '❌ Failed'}`);

  if (!cloudWorking && eaWorking) {
    console.log('\n💡 Recommendation:');
    console.log('Your API key works for monitoring but not control.');
    console.log('To enable door control, you need to:');
    console.log('');
    console.log('Option 1: Enable Remote Access');
    console.log('  1. Log into your UniFi controller');
    console.log('  2. Go to Settings > System > Advanced');
    console.log('  3. Enable "Remote Access"');
    console.log('  4. Wait 2-3 minutes for it to activate');
    console.log('');
    console.log('Option 2: Get Developer API Token');
    console.log('  1. Log into UniFi Access controller');
    console.log('  2. Go to Settings > API');
    console.log('  3. Generate a Developer API token');
    console.log('  4. Update UNIFI_ACCESS_API_TOKEN in .env');
    console.log('');
    console.log('Option 3: Use VPN/Tailscale');
    console.log('  1. Set up VPN or Tailscale to access local network');
    console.log('  2. Update UNIFI_CONTROLLER_IP in .env');
    console.log('  3. Set UNIFI_USE_REMOTE_ACCESS=false');
  }
}

// Run all tests
runAllTests().catch(console.error);