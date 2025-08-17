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

async function testDartmouthUnlock() {
  console.log(`\n${colors.cyan}╔══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║        🔓 Dartmouth Door Unlock Test 🔓                ║${colors.reset}`);
  console.log(`${colors.cyan}╚══════════════════════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.blue}📋 Configuration:${colors.reset}`);
  console.log(`   Remote Access: ${process.env.UNIFI_USE_REMOTE_ACCESS === 'true' ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`   Console ID: ${process.env.UNIFI_CONSOLE_ID ? '✓ Set' : '✗ Not set'}`);
  console.log(`   API Token: ${process.env.UNIFI_ACCESS_API_TOKEN || process.env.UNIFI_API_KEY ? '✓ Set' : '✗ Not set'}`);
  console.log(`   Dartmouth Staff Door MAC: ${process.env.DARTMOUTH_STAFF_DOOR_MAC || '28:70:4e:80:de:3b'}\n`);

  try {
    // Import the UniFi cloud service
    console.log(`${colors.yellow}🔧 Loading UniFi Service...${colors.reset}`);
    const { default: unifiCloudService } = await import('../src/services/unifiCloudService');
    
    // Check if it's in demo mode (not authenticated)
    const isDemo = !unifiCloudService['isAuthenticated'];
    console.log(`   Mode: ${isDemo ? `${colors.yellow}DEMO MODE${colors.reset}` : `${colors.green}LIVE MODE${colors.reset}`}`);
    
    if (process.env.UNIFI_USE_REMOTE_ACCESS === 'true') {
      console.log(`   Using: UniFi Cloud Proxy`);
      console.log(`   URL: https://unifi.ui.com/proxy/consoles/${process.env.UNIFI_CONSOLE_ID?.substring(0, 20)}...`);
    } else {
      console.log(`   Using: Direct Connection`);
    }

    // Test 1: Get door status
    console.log(`\n${colors.blue}🔍 Step 1: Checking door status...${colors.reset}`);
    try {
      const status = await unifiCloudService.getDoorStatus('Dartmouth');
      
      if (status && status.length > 0) {
        console.log(`   ${colors.green}✓ Retrieved status for ${status.length} door(s):${colors.reset}`);
        status.forEach((doorStatus: any) => {
          console.log(`   - ${doorStatus.name}: ${doorStatus.locked ? '🔒 Locked' : '🔓 Unlocked'}, ${doorStatus.online ? '🟢 Online' : '🔴 Offline'}`);
        });
      } else {
        console.log(`   ${colors.yellow}⚠️ No door status available (might be in demo mode)${colors.reset}`);
      }
    } catch (error: any) {
      console.log(`   ${colors.yellow}⚠️ Could not get door status: ${error.message}${colors.reset}`);
    }

    // Test 2: Attempt unlock
    console.log(`\n${colors.blue}🔓 Step 2: Testing door unlock...${colors.reset}`);
    console.log(`   Target: Dartmouth - Staff Door`);
    console.log(`   Duration: 5 seconds\n`);
    
    console.log(`${colors.magenta}   ⚠️  READY TO UNLOCK - Monitor the door now!${colors.reset}`);
    console.log(`   ${colors.yellow}The door should make a clicking sound and LED should change${colors.reset}`);
    console.log('   Press Enter to send unlock command or Ctrl+C to cancel...');
    
    // Wait for user input
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    console.log(`${colors.yellow}   Sending unlock command...${colors.reset}`);
    
    const startTime = Date.now();
    const unlockResult = await unifiCloudService.unlockDoor('Dartmouth', 'staff-door', 5);
    const responseTime = Date.now() - startTime;
    
    if (unlockResult.success) {
      console.log(`${colors.green}   ✅ UNLOCK COMMAND SUCCESSFUL!${colors.reset}`);
      console.log(`   Message: ${unlockResult.message}`);
      console.log(`   Response time: ${responseTime}ms`);
      
      if (unlockResult.message?.includes('[DEMO]')) {
        console.log(`\n   ${colors.yellow}Note: Running in demo mode - no actual door control${colors.reset}`);
      } else {
        console.log(`\n   ${colors.cyan}🚪 The door should be unlocked now for 5 seconds${colors.reset}`);
        console.log(`   ${colors.yellow}Please confirm if you heard/saw the door unlock!${colors.reset}`);
        
        // Wait and check status again
        console.log(`\n   Waiting 2 seconds before checking status...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const newStatus = await unifiCloudService.getDoorStatus('Dartmouth');
          const staffDoor = newStatus?.find((d: any) => d.name?.includes('Staff'));
          if (staffDoor) {
            console.log(`   Current status: ${staffDoor.locked ? '🔒 Locked' : '🔓 Unlocked'}`);
          }
        } catch (e) {
          // Ignore status check errors
        }
      }
    } else {
      console.log(`${colors.red}   ❌ Unlock failed${colors.reset}`);
      console.log(`   Message: ${unlockResult.message || 'Unknown error'}`);
    }

  } catch (error: any) {
    console.log(`${colors.red}❌ Test failed:${colors.reset}`);
    console.log(`   ${error.message}`);
    
    if (error.message.includes('EHOSTUNREACH') || error.message.includes('ECONNREFUSED')) {
      console.log(`\n${colors.yellow}💡 Connection Issue Detected:${colors.reset}`);
      console.log('   The service is trying to connect but cannot reach the UniFi controller.');
      console.log('   ');
      console.log('   Possible solutions:');
      console.log('   1. Set up Cloudflare Tunnel to expose port 12445');
      console.log('   2. Use ngrok: ngrok tcp 12445');
      console.log('   3. Configure port forwarding on your router');
      console.log('   4. Ensure UniFi Remote Access is enabled in the controller');
    }
  }

  console.log(`\n${colors.cyan}════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}✅ Test completed!${colors.reset}`);
  
  console.log(`\n${colors.blue}📝 Summary:${colors.reset}`);
  console.log('   If the door did NOT unlock, you need to:');
  console.log('   1. Set up network access (Cloudflare Tunnel, ngrok, or port forwarding)');
  console.log('   2. Ensure UniFi controller has Remote Access enabled');
  console.log('   3. Verify the API token has proper permissions\n');
}

// Run the test
console.log('Starting Dartmouth door unlock test...');
testDartmouthUnlock().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});