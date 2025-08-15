#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import service after env is loaded
import unifiAccessDirect from '../src/services/unifiAccessDirect';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testSessionCookie() {
  console.log('🍪 UniFi Session Cookie Test\n');
  console.log('=' .repeat(50));

  // Check configuration
  const sessionCookie = process.env.UNIFI_SESSION_COOKIE;
  const consoleId = process.env.UNIFI_CONSOLE_ID;
  const developerToken = process.env.UNIFI_ACCESS_TOKEN || process.env.UNIFI_DEVELOPER_TOKEN;
  const controllerIP = process.env.UNIFI_CONTROLLER_IP || process.env.BEDFORD_CONTROLLER_IP;

  console.log('📋 Configuration Status:');
  
  if (sessionCookie) {
    console.log(`✅ Session Cookie: Set (${sessionCookie.length} chars)`);
  } else {
    console.log('❌ Session Cookie: Not set');
  }
  
  if (developerToken) {
    console.log(`✅ Developer Token: Set`);
  } else {
    console.log('❌ Developer Token: Not set');
  }
  
  console.log(`Console ID: ${consoleId || 'Not set'}`);
  console.log(`Controller IP: ${controllerIP || 'Not set'}`);
  console.log('');

  // Check service status
  const status = unifiAccessDirect.getStatus();
  console.log('🔧 Service Status:');
  console.log(`Configured: ${status.configured ? '✅' : '❌'}`);
  console.log(`Mode: ${status.mode}`);
  if (status.baseUrl) {
    console.log(`Base URL: ${status.baseUrl}`);
  }
  console.log('');

  if (!status.configured) {
    console.log('❌ Service not configured!');
    console.log('\nTo fix this, you need EITHER:');
    console.log('\n1. Session Cookie (for cloud access):');
    console.log('   - Follow instructions in get-session-cookie.md');
    console.log('   - Add UNIFI_SESSION_COOKIE to .env');
    console.log('\n2. Developer Token (for local access):');
    console.log('   - Get from UniFi Access Settings → API');
    console.log('   - Add UNIFI_ACCESS_TOKEN to .env');
    console.log('   - Also need UNIFI_CONTROLLER_IP');
    process.exit(1);
  }

  try {
    // Test 1: Fetch doors
    console.log('📍 Test 1: Fetching doors...');
    const doors = await unifiAccessDirect.fetchAllDoors();
    
    if (!doors || doors.length === 0) {
      console.log('❌ No doors found');
      process.exit(0);
    }

    console.log(`✅ Found ${doors.length} door(s):\n`);

    // Display doors
    doors.forEach((door, index) => {
      console.log(`${index + 1}. ${door.full_name || door.name}`);
      console.log(`   ID: ${door.id}`);
      console.log(`   Can Unlock: ${door.is_bind_hub ? '✅' : '❌'}`);
      console.log(`   Status: ${door.door_lock_relay_status === 'lock' ? '🔒 Locked' : '🔓 Unlocked'}`);
      console.log('');
    });

    // Test 2: Check locking rule
    if (doors[0]) {
      console.log(`🔐 Test 2: Checking lock rule for "${doors[0].name}"...`);
      const rule = await unifiAccessDirect.fetchDoorLockingRule(doors[0].id);
      if (rule) {
        console.log(`Type: ${rule.type}`);
        if (rule.ended_time) {
          const endTime = new Date(rule.ended_time * 1000);
          console.log(`Ends: ${endTime.toLocaleString()}`);
        }
        console.log('');
      }
    }

    // Test 3: Offer to unlock
    const unlockable = doors.filter(d => d.is_bind_hub);
    if (unlockable.length > 0) {
      console.log('🔓 Test 3: Door Unlock');
      const answer = await question('Would you like to test unlocking a door? (yes/no): ');
      
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        console.log('\nSelect a door to unlock:');
        unlockable.forEach((door, index) => {
          console.log(`${index + 1}. ${door.full_name || door.name}`);
        });
        
        const selection = await question('Enter door number: ');
        const doorIndex = parseInt(selection) - 1;
        
        if (doorIndex >= 0 && doorIndex < unlockable.length) {
          const door = unlockable[doorIndex];
          
          console.log(`\n⚠️  About to unlock: ${door.full_name || door.name}`);
          const confirm = await question('Are you sure? (yes/no): ');
          
          if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
            console.log('\n🔓 Unlocking door...');
            const success = await unifiAccessDirect.unlockDoorForDuration(door.id, 30);
            
            if (success) {
              console.log('✅ Door unlocked successfully!');
              console.log('It will automatically lock after 30 seconds.');
            } else {
              console.log('❌ Failed to unlock door');
            }
          }
        }
      }
    }

    console.log('\n✅ All tests completed!');
    
    if (status.mode === 'cloud') {
      console.log('\n⚠️  Using session cookie authentication');
      console.log('Remember: Session cookies expire after 24-48 hours');
      console.log('You\'ll need to refresh it periodically');
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('401')) {
      console.log('\n💡 Authentication failed. Your session cookie may have expired.');
      console.log('Follow the instructions in get-session-cookie.md to get a new one.');
    }
  } finally {
    rl.close();
  }
}

// Run the test
testSessionCookie().catch(console.error);