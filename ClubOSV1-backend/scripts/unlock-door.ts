#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import the new API service
import unifiAccessAPI from '../src/services/unifiAccessAPI';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function unlockDoor() {
  console.log('🔓 UniFi Access Door Unlock Tool\n');

  try {
    // First, fetch all doors
    console.log('📍 Fetching available doors...');
    const doors = await unifiAccessAPI.fetchAllDoors();
    
    if (!doors || doors.length === 0) {
      console.log('❌ No doors found');
      process.exit(1);
    }

    // Filter to only hub-bound doors (can be remotely unlocked)
    const unlockableDoors = doors.filter(d => d.is_bind_hub);
    
    if (unlockableDoors.length === 0) {
      console.log('❌ No doors can be remotely unlocked (none are hub-bound)');
      process.exit(1);
    }

    // Display available doors
    console.log(`\nFound ${unlockableDoors.length} door(s) that can be unlocked:\n`);
    unlockableDoors.forEach((door, index) => {
      console.log(`${index + 1}. ${door.full_name || door.name}`);
      console.log(`   Status: ${door.door_lock_relay_status === 'lock' ? '🔒 Locked' : '🔓 Unlocked'}`);
      console.log(`   Position: ${door.door_position_status === 'close' ? '🚪 Closed' : '🚪 Open'}`);
      console.log(`   ID: ${door.id}`);
      console.log('');
    });

    // Get user selection
    const selection = await question('Enter the number of the door to unlock (or "q" to quit): ');
    
    if (selection.toLowerCase() === 'q') {
      console.log('Cancelled.');
      process.exit(0);
    }

    const doorIndex = parseInt(selection) - 1;
    if (isNaN(doorIndex) || doorIndex < 0 || doorIndex >= unlockableDoors.length) {
      console.log('❌ Invalid selection');
      process.exit(1);
    }

    const selectedDoor = unlockableDoors[doorIndex];

    // Get unlock duration
    const durationStr = await question('Enter unlock duration in seconds (default: 30): ');
    const durationSeconds = durationStr ? parseInt(durationStr) : 30;
    
    if (isNaN(durationSeconds) || durationSeconds < 1 || durationSeconds > 3600) {
      console.log('❌ Invalid duration (must be between 1 and 3600 seconds)');
      process.exit(1);
    }

    // Confirm action
    console.log(`\n⚠️  About to unlock: ${selectedDoor.full_name || selectedDoor.name}`);
    console.log(`Duration: ${durationSeconds} seconds`);
    const confirm = await question('Are you sure? (yes/no): ');
    
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      process.exit(0);
    }

    // Perform unlock
    console.log(`\n🔓 Unlocking ${selectedDoor.name}...`);
    
    const durationMinutes = durationSeconds / 60;
    const success = await unifiAccessAPI.unlockDoorForDuration(selectedDoor.id, durationMinutes);
    
    if (success) {
      console.log(`✅ Successfully unlocked ${selectedDoor.name} for ${durationSeconds} seconds!`);
      console.log('\nThe door will automatically lock after the duration expires.');
      
      // Check current status
      console.log('\n📊 Checking door status...');
      const lockingRule = await unifiAccessAPI.fetchDoorLockingRule(selectedDoor.id);
      if (lockingRule) {
        console.log(`Current rule: ${lockingRule.type}`);
        if (lockingRule.ended_time) {
          const endTime = new Date(lockingRule.ended_time * 1000);
          console.log(`Will lock at: ${endTime.toLocaleString()}`);
        }
      }
    } else {
      console.log('❌ Failed to unlock door');
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('401') || error.message.includes('403')) {
      console.log('\n💡 Authentication issue. Check your API token permissions.');
    } else if (error.message.includes('404')) {
      console.log('\n💡 Door not found or API endpoint not available.');
    }
  } finally {
    rl.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const helpRequested = args.includes('--help') || args.includes('-h');

if (helpRequested) {
  console.log('UniFi Access Door Unlock Tool');
  console.log('');
  console.log('Usage: npm run unlock:door');
  console.log('');
  console.log('This interactive tool will:');
  console.log('1. List all available doors');
  console.log('2. Let you select a door to unlock');
  console.log('3. Ask for unlock duration');
  console.log('4. Confirm and unlock the door');
  process.exit(0);
}

// Run the tool
unlockDoor().catch(console.error);