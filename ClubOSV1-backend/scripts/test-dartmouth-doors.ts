#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

const CONSOLE_ID = '0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302';

console.log('========================================');
console.log('Dartmouth UniFi Access Test');
console.log('========================================\n');

console.log('Console ID:', CONSOLE_ID);
console.log('Direct Link: https://unifi.ui.com/consoles/' + CONSOLE_ID + '/access/dashboard\n');

// Check if credentials are configured
const username = process.env.UNIFI_CLOUD_USERNAME;
const password = process.env.UNIFI_CLOUD_PASSWORD;

if (!username || !password) {
  console.log('⚠️  Cloud credentials not configured!\n');
  console.log('Add these to your .env file:');
  console.log('UNIFI_CLOUD_USERNAME=your-ubiquiti-email@example.com');
  console.log('UNIFI_CLOUD_PASSWORD=your-password');
  console.log('UNIFI_CONSOLE_ID=' + CONSOLE_ID);
  console.log('\nThen run this test again.');
  process.exit(1);
}

console.log('✅ Credentials found for:', username);
console.log('Attempting to connect to Dartmouth UniFi Access...\n');

async function testDartmouthAccess() {
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
    const cookies = authResponse.headers.get('set-cookie');
    console.log('   ✅ Cloud authentication successful\n');

    // Step 2: Try to access the Dartmouth console
    console.log('2. Accessing Dartmouth UniFi Access console...');
    const consoleUrl = `https://unifi.ui.com/proxy/consoles/${CONSOLE_ID}/access/api/v1/info`;
    
    const infoResponse = await fetch(consoleUrl, {
      headers: {
        'Cookie': cookies || ''
      }
    });

    if (infoResponse.ok) {
      const info = await infoResponse.json();
      console.log('   ✅ Successfully connected to Dartmouth console!');
      console.log('   Console Info:', JSON.stringify(info, null, 2).substring(0, 200) + '...\n');
    } else {
      console.log('   ⚠️  Could not access console (status: ' + infoResponse.status + ')');
      console.log('   This might mean:');
      console.log('   - The console ID is incorrect');
      console.log('   - Your account doesn\'t have access to this console');
      console.log('   - Remote access is not enabled\n');
    }

    // Step 3: Try to list doors
    console.log('3. Attempting to list doors...');
    const doorsUrl = `https://unifi.ui.com/proxy/consoles/${CONSOLE_ID}/access/api/v1/developer/doors`;
    
    const doorsResponse = await fetch(doorsUrl, {
      headers: {
        'Cookie': cookies || '',
        'Content-Type': 'application/json'
      }
    });

    if (doorsResponse.ok) {
      const doors = await doorsResponse.json();
      console.log('   ✅ Found doors in the system!');
      
      if (Array.isArray(doors)) {
        console.log(`   Total doors: ${doors.length}\n`);
        
        console.log('   Door IDs for .env configuration:');
        doors.forEach((door: any) => {
          const name = door.name || door.display_name || 'Unknown';
          const id = door.id || door.door_id || door.mac;
          console.log(`   - ${name}: ${id}`);
        });
        
        console.log('\n   Add these to your .env file:');
        console.log('   DARTMOUTH_MAIN_DOOR_ID=<id-from-above>');
        console.log('   DARTMOUTH_STAFF_DOOR_ID=<id-from-above>');
        console.log('   DARTMOUTH_BAY_DOOR_ID=<id-from-above>');
        console.log('   DARTMOUTH_EMERGENCY_DOOR_ID=<id-from-above>');
      } else {
        console.log('   Response:', JSON.stringify(doors, null, 2).substring(0, 500));
      }
    } else {
      const errorText = await doorsResponse.text();
      console.log('   ❌ Could not list doors (status: ' + doorsResponse.status + ')');
      console.log('   Error:', errorText.substring(0, 200));
      console.log('\n   The API endpoint might be different. Try checking:');
      console.log('   - /api/v1/door');
      console.log('   - /api/v1/devices');
      console.log('   - /api/doors');
    }

    console.log('\n========================================');
    console.log('Test Complete');
    console.log('========================================\n');

    if (infoResponse.ok) {
      console.log('✅ SUCCESS! You can connect to Dartmouth UniFi Access');
      console.log('\nNext steps:');
      console.log('1. Note the door IDs from above');
      console.log('2. Add them to your .env file');
      console.log('3. Test door control with: npm run test:unifi-cloud');
    } else {
      console.log('⚠️  Partial success - authenticated but couldn\'t access console');
      console.log('\nTroubleshooting:');
      console.log('1. Verify the console ID is correct');
      console.log('2. Check if your account has access at: https://unifi.ui.com');
      console.log('3. Ensure Remote Access is enabled in UniFi settings');
    }

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('Authentication failed')) {
      console.log('\nTroubleshooting authentication:');
      console.log('1. Verify your Ubiquiti account credentials');
      console.log('2. Check if 2FA is enabled (may need app-specific password)');
      console.log('3. Try logging in at https://unifi.ui.com to verify credentials');
    }
  }
}

// Run the test
testDartmouthAccess().catch(console.error);