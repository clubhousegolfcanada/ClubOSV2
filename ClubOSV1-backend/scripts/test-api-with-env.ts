#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Now check that env vars are loaded
console.log('🔍 Environment Check:');
console.log('UNIFI_ACCESS_API_TOKEN:', process.env.UNIFI_ACCESS_API_TOKEN ? '✅ Set' : '❌ Not set');
console.log('UNIFI_CONTROLLER_HOST:', process.env.UNIFI_CONTROLLER_HOST || 'Not set');
console.log('');

// Only import the service AFTER environment is loaded
import('../src/services/unifiAccessAPI').then(async (module) => {
  const unifiAccessAPI = module.default;
  
  console.log('🔧 Testing UniFi Access Official API...\n');

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

      // Test 2: Check if API is configured
      console.log('🔐 API Configuration Status:');
      console.log(`Configured: ${unifiAccessAPI.isApiConfigured() ? '✅ Yes' : '❌ No (Demo Mode)'}`);
      console.log('');

      if (unifiAccessAPI.isApiConfigured()) {
        console.log('🎉 Great! The API is configured and ready to control doors.');
        console.log('\nTo unlock a door, run:');
        console.log('npm run unlock:door');
      } else {
        console.log('⚠️  Running in DEMO mode. Real door control not available.');
        console.log('\nPossible issues:');
        console.log('1. API token might be read-only');
        console.log('2. Need Developer API token from UniFi Access');
        console.log('3. May need to use OAuth authentication instead');
      }

    } else {
      console.log('⚠️  No doors found.');
    }

  } catch (error: any) {
    console.error('\n❌ Error during testing:', error.message);
  }
}).catch(console.error);