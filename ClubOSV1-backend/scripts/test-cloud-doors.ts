#!/usr/bin/env npx tsx
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testCloudDoors() {
  console.log('🚪 UniFi Access Cloud Door Control Test\n');

  const consoleId = process.env.UNIFI_CONSOLE_ID;
  const apiToken = process.env.UNIFI_ACCESS_API_TOKEN || process.env.UNIFI_API_KEY;
  
  if (!consoleId || !apiToken) {
    console.log('❌ Missing configuration');
    console.log('Console ID:', consoleId ? '✅' : '❌');
    console.log('API Token:', apiToken ? '✅' : '❌');
    process.exit(1);
  }

  const baseUrl = `https://unifi.ui.com/proxy/consoles/${consoleId}/access`;
  console.log(`Using cloud proxy: ${baseUrl}\n`);

  try {
    // Step 1: Fetch all doors
    console.log('📍 Fetching doors from UniFi Access...');
    const doorsResponse = await fetch(`${baseUrl}/api/v1/developer/doors`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log(`Response status: ${doorsResponse.status} ${doorsResponse.statusText}`);

    if (!doorsResponse.ok) {
      const errorText = await doorsResponse.text();
      console.log('Response body:', errorText);
      
      if (doorsResponse.status === 401) {
        console.log('\n❌ Authentication failed. The API token may not have the right permissions.');
        console.log('Try using your UniFi account credentials instead.');
      } else if (doorsResponse.status === 404) {
        console.log('\n❌ API endpoint not found. Remote Access may not be enabled.');
      }
      
      process.exit(1);
    }

    const doorsResult = await doorsResponse.json();
    
    if (doorsResult.code !== 'SUCCESS' || !doorsResult.data) {
      console.log('❌ Unexpected response format:', JSON.stringify(doorsResult, null, 2));
      process.exit(1);
    }

    const doors = doorsResult.data;
    console.log(`\n✅ Found ${doors.length} door(s)!\n`);

    if (doors.length === 0) {
      console.log('No doors to control.');
      process.exit(0);
    }

    // Display doors
    doors.forEach((door: any, index: number) => {
      console.log(`${index + 1}. ${door.full_name || door.name}`);
      console.log(`   ID: ${door.id}`);
      console.log(`   Hub Bound: ${door.is_bind_hub ? '✅ Can unlock remotely' : '❌ Cannot unlock remotely'}`);
      console.log(`   Status: ${door.door_lock_relay_status === 'lock' ? '🔒 Locked' : '🔓 Unlocked'}`);
      console.log(`   Position: ${door.door_position_status || 'Unknown'}`);
      console.log('');
    });

    // Filter unlockable doors
    const unlockableDoors = doors.filter((d: any) => d.is_bind_hub);
    
    if (unlockableDoors.length === 0) {
      console.log('❌ No doors can be unlocked remotely (none are hub-bound)');
      process.exit(0);
    }

    // Step 2: Select a door to unlock
    const selection = await question('Enter door number to unlock (or "q" to quit): ');
    
    if (selection.toLowerCase() === 'q') {
      console.log('Cancelled.');
      process.exit(0);
    }

    const doorIndex = parseInt(selection) - 1;
    if (isNaN(doorIndex) || doorIndex < 0 || doorIndex >= doors.length) {
      console.log('❌ Invalid selection');
      process.exit(1);
    }

    const selectedDoor = doors[doorIndex];
    
    if (!selectedDoor.is_bind_hub) {
      console.log('❌ This door cannot be unlocked remotely');
      process.exit(1);
    }

    // Step 3: Confirm unlock
    console.log(`\n⚠️  About to unlock: ${selectedDoor.full_name || selectedDoor.name}`);
    const confirm = await question('Are you sure? (yes/no): ');
    
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      process.exit(0);
    }

    // Step 4: Perform unlock
    console.log(`\n🔓 Unlocking ${selectedDoor.name}...`);
    
    const unlockResponse = await fetch(`${baseUrl}/api/v1/developer/doors/${selectedDoor.id}/remote_unlock`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        actor_id: 'clubos-test',
        actor_name: 'ClubOS Test Script',
        extra: {
          source: 'test-script',
          timestamp: new Date().toISOString()
        }
      })
    });

    console.log(`Unlock response: ${unlockResponse.status} ${unlockResponse.statusText}`);

    if (!unlockResponse.ok) {
      const errorText = await unlockResponse.text();
      console.log('❌ Unlock failed:', errorText);
      process.exit(1);
    }

    const unlockResult = await unlockResponse.json();
    
    if (unlockResult.code === 'SUCCESS') {
      console.log(`✅ Successfully unlocked ${selectedDoor.name}!`);
      console.log('The door will automatically lock after the default duration.');
    } else {
      console.log('❌ Unlock failed:', unlockResult.msg || 'Unknown error');
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Connection refused. Check your internet connection.');
    } else if (error.message.includes('ETIMEDOUT')) {
      console.log('\n💡 Connection timeout. The cloud service may be unreachable.');
    }
  } finally {
    rl.close();
  }
}

// Run the test
console.log('=' .repeat(50));
console.log('UniFi Access Cloud Door Control');
console.log('=' .repeat(50));

testCloudDoors().catch(console.error);