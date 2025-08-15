#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import { logger } from '../src/utils/logger';
import readline from 'readline';

// Load environment variables
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('========================================');
console.log('UniFi Door Unlock Test');
console.log('========================================\n');

console.log('⚠️  WARNING: This will ACTUALLY unlock a real door!\n');

console.log('Available doors:');
console.log('1. Bedford Front Door (28:70:4e:80:c4:4f)');
console.log('2. Bedford Middle Door (28:70:4e:80:de:f3)');
console.log('3. Dartmouth Staff Door (28:70:4e:80:de:3b)\n');

async function testUnlock() {
  const { default: doorService } = await import('../src/services/unifiCloudService');
  
  if (doorService.isInDemoMode()) {
    console.log('❌ System is in DEMO mode - cannot unlock real doors');
    console.log('Check your API key configuration');
    process.exit(1);
  }
  
  console.log('✅ Connected to UniFi with API key\n');
  
  rl.question('Which door to unlock? (1-3 or q to quit): ', async (answer) => {
    if (answer.toLowerCase() === 'q') {
      console.log('Exiting without unlocking');
      rl.close();
      process.exit(0);
    }
    
    let location = '';
    let doorKey = '';
    let doorName = '';
    
    switch(answer) {
      case '1':
        location = 'Bedford';
        doorKey = 'main-entrance';
        doorName = 'Bedford Front Door';
        break;
      case '2':
        location = 'Bedford';
        doorKey = 'middle-door';
        doorName = 'Bedford Middle Door';
        break;
      case '3':
        location = 'Dartmouth';
        doorKey = 'staff-door';
        doorName = 'Dartmouth Staff Door';
        break;
      default:
        console.log('Invalid selection');
        rl.close();
        process.exit(1);
    }
    
    rl.question(`Confirm: Unlock ${doorName} for how many seconds? (5-60): `, async (duration) => {
      const seconds = parseInt(duration);
      if (isNaN(seconds) || seconds < 5 || seconds > 60) {
        console.log('Invalid duration. Using 10 seconds.');
        duration = '10';
      }
      
      console.log(`\n🔓 Unlocking ${doorName} for ${duration} seconds...`);
      
      try {
        const result = await doorService.unlockDoor(location, doorKey, parseInt(duration));
        
        if (result.success) {
          console.log(`✅ SUCCESS: ${result.message}`);
          console.log(`Door will automatically lock after ${duration} seconds`);
        } else {
          console.log(`❌ FAILED: ${result.message}`);
        }
      } catch (error: any) {
        console.error(`❌ ERROR: ${error.message}`);
        console.log('\nTroubleshooting:');
        console.log('1. Check if the API key is correct');
        console.log('2. Verify the door MAC addresses are correct');
        console.log('3. Ensure the doors are online in UniFi');
      } finally {
        rl.close();
      }
    });
  });
}

testUnlock().catch(error => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});