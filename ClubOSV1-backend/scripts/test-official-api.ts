#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import the new API service
import unifiAccessAPI from '../src/services/unifiAccessAPI';

async function testUnifiAccessAPI() {
  console.log('🔧 Testing UniFi Access Official API...\n');

  // Display configuration
  console.log('📋 Configuration:');
  console.log('API Token:', process.env.UNIFI_ACCESS_API_TOKEN ? '✅ Set' : '❌ Not set');
  console.log('Controller Host:', process.env.UNIFI_CONTROLLER_HOST || 'Not set');
  console.log('Controller Port:', process.env.UNIFI_CONTROLLER_PORT || '443');
  console.log('Use Local Access:', process.env.UNIFI_USE_LOCAL_ACCESS === 'true' ? 'Yes' : 'No');
  console.log('');

  try {
    // Test 1: Fetch all doors
    console.log('📍 Test 1: Fetching all doors...');
    const doors = await unifiAccessAPI.fetchAllDoors();
    
    if (doors && doors.length > 0) {
      console.log(`✅ Found ${doors.length} door(s):\n`);
      
      doors.forEach((door, index) => {
        console.log(`Door ${index + 1}:`);
        console.log(`  ID: ${door.id}`);
        console.log(`  Name: ${door.name}`);
        console.log(`  Full Name: ${door.full_name}`);
        console.log(`  Type: ${door.type}`);
        console.log(`  Hub Bound: ${door.is_bind_hub ? 'Yes' : 'No'}`);
        console.log(`  Lock Status: ${door.door_lock_relay_status}`);
        console.log(`  Position: ${door.door_position_status || 'Unknown'}`);
        console.log('');
      });

      // Test 2: Check emergency status
      console.log('🚨 Test 2: Checking emergency status...');
      const emergencyStatus = await unifiAccessAPI.fetchEmergencyStatus();
      if (emergencyStatus) {
        console.log('Emergency Status:');
        console.log(`  Lockdown: ${emergencyStatus.lockdown ? '🔒 Active' : '✅ Inactive'}`);
        console.log(`  Evacuation: ${emergencyStatus.evacuation ? '🚪 Active' : '✅ Inactive'}`);
        console.log('');
      }

      // Test 3: Check locking rule for first door
      if (doors[0] && doors[0].is_bind_hub) {
        console.log(`🔐 Test 3: Checking locking rule for "${doors[0].name}"...`);
        const lockingRule = await unifiAccessAPI.fetchDoorLockingRule(doors[0].id);
        if (lockingRule) {
          console.log('Locking Rule:');
          console.log(`  Type: ${lockingRule.type}`);
          console.log(`  Ends at: ${new Date(lockingRule.ended_time * 1000).toLocaleString()}`);
          console.log('');
        }
      }

      // Test 4: Offer to unlock a door (with confirmation)
      const hubBoundDoors = doors.filter(d => d.is_bind_hub);
      if (hubBoundDoors.length > 0) {
        console.log('🔓 Test 4: Door unlock test');
        console.log(`Found ${hubBoundDoors.length} door(s) that can be remotely unlocked.`);
        console.log('\nTo test unlocking, run:');
        console.log(`npm run test:unlock-door -- --doorId="${hubBoundDoors[0].id}" --doorName="${hubBoundDoors[0].name}"`);
      }

      console.log('\n✅ All tests completed successfully!');
      console.log('The UniFi Access API is properly configured and working.');

    } else {
      console.log('⚠️  No doors found. This could mean:');
      console.log('1. The API is working but no doors are configured');
      console.log('2. The API token doesn\'t have permission to view doors');
      console.log('3. The controller URL is incorrect');
    }

  } catch (error: any) {
    console.error('\n❌ Error during testing:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Connection refused. Please check:');
      console.log('1. The controller host is correct');
      console.log('2. The controller is running and accessible');
      console.log('3. If using local access, ensure you\'re on the same network or using VPN');
    } else if (error.message.includes('401') || error.message.includes('403')) {
      console.log('\n💡 Authentication failed. Please check:');
      console.log('1. The API token is correct');
      console.log('2. The token has the necessary permissions');
      console.log('3. The token hasn\'t expired');
    } else if (error.message.includes('404')) {
      console.log('\n💡 API endpoint not found. Please check:');
      console.log('1. The controller supports the Developer API');
      console.log('2. The UniFi Access version is up to date');
      console.log('3. The base URL is correct');
    }
  }
}

// Run the test
testUnifiAccessAPI().catch(console.error);