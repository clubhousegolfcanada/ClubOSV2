#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

async function testDartmouthDirect() {
  console.log(`\n${colors.cyan}╔══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║      🔓 Dartmouth UniFi Direct Service Test 🔓         ║${colors.reset}`);
  console.log(`${colors.cyan}╚══════════════════════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.blue}📋 Configuration Check:${colors.reset}`);
  console.log(`   UNIFI_USE_REMOTE_ACCESS: ${process.env.UNIFI_USE_REMOTE_ACCESS}`);
  console.log(`   UNIFI_CONSOLE_ID: ${process.env.UNIFI_CONSOLE_ID ? '✓ Set' : '✗ Not set'}`);
  console.log(`   DARTMOUTH_ACCESS_TOKEN: ${process.env.DARTMOUTH_ACCESS_TOKEN ? '✓ Set' : '✗ Not set'}`);
  console.log(`   DARTMOUTH_CONTROLLER_IP: ${process.env.DARTMOUTH_CONTROLLER_IP}`);
  console.log(`   DARTMOUTH_STAFF_DOOR_MAC: ${process.env.DARTMOUTH_STAFF_DOOR_MAC}\n`);

  try {
    // Import the UniFi cloud service
    console.log(`${colors.yellow}🔧 Loading UniFi Cloud Service...${colors.reset}`);
    const { default: unifiCloudService } = await import('../src/services/unifiCloudService');
    
    // Check if in demo mode
    const isDemoMode = unifiCloudService.isInDemoMode();
    console.log(`   Service Mode: ${isDemoMode ? `${colors.yellow}DEMO MODE${colors.reset}` : `${colors.green}LIVE MODE${colors.reset}`}`);
    
    if (isDemoMode) {
      console.log(`   ${colors.yellow}⚠️ Running in demo mode - no actual door control${colors.reset}\n`);
    }

    // Test 1: Get available doors
    console.log(`${colors.blue}📍 Step 1: Getting available doors at Dartmouth...${colors.reset}`);
    const doors = await unifiCloudService.getDoors('Dartmouth');
    
    if (doors && doors.length > 0) {
      console.log(`   Found ${doors.length} door(s):`);
      doors.forEach((door: any) => {
        console.log(`   - ${door.name} (${door.doorKey})`);
        console.log(`     Type: ${door.type}, Status: ${door.locked ? '🔒 Locked' : '🔓 Unlocked'}`);
      });
    } else {
      console.log(`   ${colors.yellow}No doors configured for Dartmouth${colors.reset}`);
    }

    // Test 2: Get door status
    console.log(`\n${colors.blue}🔍 Step 2: Getting door status...${colors.reset}`);
    const status = await unifiCloudService.getDoorStatus('Dartmouth');
    
    if (status && status.length > 0) {
      console.log(`   Door statuses:`);
      status.forEach((doorStatus: any) => {
        console.log(`   - ${doorStatus.name}: ${doorStatus.locked ? '🔒 Locked' : '🔓 Unlocked'}, ${doorStatus.online ? '🟢 Online' : '🔴 Offline'}`);
      });
    } else {
      console.log(`   ${colors.yellow}Could not retrieve door status${colors.reset}`);
    }

    // Test 3: Attempt unlock
    console.log(`\n${colors.blue}🔓 Step 3: Testing door unlock...${colors.reset}`);
    console.log(`   Target: Dartmouth Staff Door`);
    console.log(`   Duration: 5 seconds\n`);
    
    console.log(`${colors.magenta}   ⚠️  READY TO UNLOCK - Monitor the door now!${colors.reset}`);
    console.log('   Press Enter to send unlock command or Ctrl+C to cancel...');
    
    // Wait for user input
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    console.log(`${colors.yellow}   Sending unlock command...${colors.reset}`);
    
    const unlockResult = await unifiCloudService.unlockDoor('Dartmouth', 'staff-door', 5);
    
    if (unlockResult.success) {
      console.log(`${colors.green}   ✅ UNLOCK COMMAND SUCCESSFUL!${colors.reset}`);
      console.log(`   Message: ${unlockResult.message}`);
      console.log(`   Door ID: ${unlockResult.doorId}`);
      console.log(`   Duration: ${unlockResult.unlockDuration} seconds`);
      
      if (!isDemoMode) {
        console.log(`\n   ${colors.yellow}Please check if the door physically unlocked!${colors.reset}`);
      }
    } else {
      console.log(`${colors.red}   ❌ Unlock failed${colors.reset}`);
      console.log(`   Message: ${unlockResult.message || 'Unknown error'}`);
    }

    // Test 4: Check connection details
    console.log(`\n${colors.blue}🔌 Step 4: Connection Details...${colors.reset}`);
    
    // Try to get more info about the connection
    const isAuthenticated = await unifiCloudService.testConnection();
    console.log(`   Authentication: ${isAuthenticated ? `${colors.green}✓ Connected${colors.reset}` : `${colors.red}✗ Not connected${colors.reset}`}`);
    
    if (!isAuthenticated && !isDemoMode) {
      console.log(`\n${colors.yellow}💡 Troubleshooting Tips:${colors.reset}`);
      console.log('   1. Enable Remote Access in UniFi controller:');
      console.log('      Dashboard > Settings > System > Remote Access > Enable');
      console.log('   2. Ensure the Console ID is correct (from UniFi UI)');
      console.log('   3. Check if the API token has door control permissions');
      console.log('   4. Try using a Cloudflare Tunnel or port forwarding if direct access fails');
    }

  } catch (error: any) {
    console.log(`${colors.red}❌ Test failed:${colors.reset}`);
    console.log(`   ${error.message}`);
    console.log(`\n${colors.yellow}Stack trace:${colors.reset}`);
    console.log(error.stack);
  }

  console.log(`\n${colors.cyan}════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}✅ Test completed!${colors.reset}\n`);
}

// Run the test
console.log('Starting Dartmouth UniFi direct service test...');
testDartmouthDirect().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});