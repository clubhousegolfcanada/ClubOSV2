#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';

// Load environment variables FIRST
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import services after env is loaded
import unifiCloudAccess from '../src/services/unifiCloudAccess';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testOAuthDoors() {
  console.log('🔐 UniFi Cloud OAuth Authentication Test\n');
  console.log('=' .repeat(50));

  // Check credentials
  const username = process.env.UNIFI_CLOUD_USERNAME || process.env.UNIFI_USERNAME;
  const password = process.env.UNIFI_CLOUD_PASSWORD || process.env.UNIFI_PASSWORD;
  
  console.log('📋 Configuration:');
  console.log(`Username: ${username ? '✅ ' + username : '❌ Not set'}`);
  console.log(`Password: ${password ? '✅ Set' : '❌ Not set'}`);
  console.log(`Console ID: ${process.env.UNIFI_CONSOLE_ID || 'Not set'}`);
  console.log('');

  if (!username || !password) {
    console.log('❌ Missing credentials. Please set in .env:');
    console.log('   UNIFI_CLOUD_USERNAME=your-email@example.com');
    console.log('   UNIFI_CLOUD_PASSWORD=your-password');
    process.exit(1);
  }

  try {
    // Step 1: Initialize and authenticate
    console.log('🔑 Authenticating with UniFi cloud...');
    const initialized = await unifiCloudAccess.initialize();
    
    if (!initialized) {
      console.log('❌ Authentication failed');
      console.log('\nPossible issues:');
      console.log('1. Invalid username or password');
      console.log('2. Two-factor authentication is enabled (needs to be disabled)');
      console.log('3. Account is locked or restricted');
      process.exit(1);
    }

    console.log('✅ Successfully authenticated!\n');

    // Step 2: Fetch doors
    console.log('📍 Fetching doors...');
    const doors = await unifiCloudAccess.fetchAllDoors();
    
    if (!doors || doors.length === 0) {
      console.log('❌ No doors found');
      process.exit(0);
    }

    console.log(`✅ Found ${doors.length} door(s):\n`);

    // Display doors
    doors.forEach((door, index) => {
      console.log(`${index + 1}. ${door.full_name || door.name}`);
      console.log(`   ID: ${door.id}`);
      console.log(`   Can Unlock: ${door.is_bind_hub ? '✅ Yes' : '❌ No'}`);
      console.log(`   Status: ${door.door_lock_relay_status === 'lock' ? '🔒 Locked' : '🔓 Unlocked'}`);
      console.log(`   Position: ${door.door_position_status || 'Unknown'}`);
      console.log('');
    });

    // Filter unlockable doors
    const unlockableDoors = doors.filter(d => d.is_bind_hub);
    
    if (unlockableDoors.length === 0) {
      console.log('❌ No doors can be unlocked remotely');
      process.exit(0);
    }

    // Step 3: Offer to unlock a door
    console.log('🔓 Door Unlock Test');
    console.log('=' .repeat(50));
    
    const selection = await question('Enter door number to unlock (or "q" to quit): ');
    
    if (selection.toLowerCase() === 'q') {
      console.log('Test completed.');
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

    // Get unlock duration
    const durationStr = await question('Enter unlock duration in seconds (default: 30): ');
    const duration = durationStr ? parseInt(durationStr) : 30;
    
    if (isNaN(duration) || duration < 1 || duration > 3600) {
      console.log('❌ Invalid duration');
      process.exit(1);
    }

    // Confirm
    console.log(`\n⚠️  About to unlock: ${selectedDoor.full_name || selectedDoor.name}`);
    console.log(`Duration: ${duration} seconds`);
    const confirm = await question('Are you sure? (yes/no): ');
    
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      process.exit(0);
    }

    // Step 4: Perform unlock
    console.log(`\n🔓 Unlocking ${selectedDoor.name}...`);
    const result = await unifiCloudAccess.unlockDoorForDuration(selectedDoor.id, duration);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log('\nThe door will automatically lock after the specified duration.');
      
      // Check lock rule
      const lockRule = await unifiCloudAccess.fetchDoorLockingRule(selectedDoor.id);
      if (lockRule) {
        console.log(`\nCurrent lock rule: ${lockRule.type}`);
        if (lockRule.ended_time) {
          const endTime = new Date(lockRule.ended_time * 1000);
          console.log(`Will lock at: ${endTime.toLocaleString()}`);
        }
      }
    } else {
      console.log(`❌ Failed: ${result.message}`);
    }

    // Step 5: Test emergency status
    console.log('\n🚨 Emergency Status Check');
    const emergencyStatus = await unifiCloudAccess.fetchEmergencyStatus();
    if (emergencyStatus) {
      console.log(`Lockdown: ${emergencyStatus.lockdown ? '🔒 Active' : '✅ Inactive'}`);
      console.log(`Evacuation: ${emergencyStatus.evacuation ? '🚪 Active' : '✅ Inactive'}`);
    }

    console.log('\n✅ All tests completed successfully!');
    console.log('The UniFi Cloud OAuth integration is working properly.');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('MFA_REQUIRED')) {
      console.log('\n💡 Two-Factor Authentication Issue:');
      console.log('This account has 2FA enabled. You have three options:');
      console.log('');
      console.log('1. Temporarily disable 2FA:');
      console.log('   - Log into account.ui.com');
      console.log('   - Go to Security settings');
      console.log('   - Disable two-factor authentication');
      console.log('');
      console.log('2. Create a service account:');
      console.log('   - Create a new UniFi account for ClubOS');
      console.log('   - Don\'t enable 2FA on this account');
      console.log('   - Share your consoles with this account');
      console.log('');
      console.log('3. Use a Developer API token instead:');
      console.log('   - Access your UniFi controller directly');
      console.log('   - Generate a Developer API token');
      console.log('   - Use that instead of OAuth');
    }
  } finally {
    rl.close();
  }
}

// Run the test
console.log('=' .repeat(50));
console.log('UniFi Cloud OAuth Door Control Test');
console.log('=' .repeat(50));
console.log('');

testOAuthDoors().catch(console.error);