#!/usr/bin/env npx tsx
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from '../src/utils/logger';

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

async function testUnifiDoorViaAPI() {
  console.log(`\n${colors.cyan}╔══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║      🔓 UniFi Door Test via ClubOS API 🔓              ║${colors.reset}`);
  console.log(`${colors.cyan}╚══════════════════════════════════════════════════════════╝${colors.reset}\n`);

  // Start the backend server if not running
  console.log(`${colors.yellow}📋 Testing UniFi door control through ClubOS backend API${colors.reset}`);
  console.log('   This tests the actual production configuration\n');

  // First, let's check door status
  console.log(`${colors.blue}🔍 Step 1: Checking door status via API...${colors.reset}`);
  
  try {
    const statusResponse = await fetch('http://localhost:5005/api/doors/status', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        // Add a mock auth token for testing
        'Authorization': 'Bearer test-token'
      }
    });

    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log(`${colors.green}   ✓ Door status retrieved:${colors.reset}`);
      console.log(JSON.stringify(status, null, 2));
    } else {
      console.log(`${colors.yellow}   ⚠️ Status endpoint returned: ${statusResponse.status}${colors.reset}`);
      const text = await statusResponse.text();
      console.log(`   Response: ${text}`);
    }
  } catch (error: any) {
    console.log(`${colors.yellow}   ℹ️ Status endpoint not available or server not running${colors.reset}`);
  }

  // Test unlock through the actual API endpoint
  console.log(`\n${colors.blue}🔓 Step 2: Testing door unlock via API endpoint...${colors.reset}`);
  console.log(`   Target: Dartmouth - Staff Door`);
  console.log(`   Duration: 5 seconds\n`);
  
  console.log(`${colors.magenta}   ⚠️  READY TO UNLOCK - Monitor the door now!${colors.reset}`);
  console.log('   Press Enter to send unlock command or Ctrl+C to cancel...');
  
  // Wait for user input
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  try {
    const unlockResponse = await fetch('http://localhost:5005/api/doors/unlock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Add a mock auth token for testing
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        location: 'Dartmouth',
        doorKey: 'staff-door',
        duration: 5,
        reason: 'API test from ClubOS script'
      })
    });

    if (unlockResponse.ok) {
      const result = await unlockResponse.json();
      console.log(`${colors.green}   ✓ API call successful!${colors.reset}`);
      console.log(`   Response:`, JSON.stringify(result, null, 2));
      
      if (result.success) {
        console.log(`\n${colors.green}   🎉 Door unlock command sent successfully!${colors.reset}`);
        console.log(`   Duration: ${result.duration} seconds`);
        console.log(`   ${colors.yellow}Please check if the door physically unlocked!${colors.reset}`);
      } else {
        console.log(`${colors.red}   ✗ Unlock failed: ${result.message}${colors.reset}`);
      }
    } else {
      const errorText = await unlockResponse.text();
      console.log(`${colors.red}   ✗ API call failed: ${unlockResponse.status}${colors.reset}`);
      console.log(`   Error: ${errorText}`);
      
      if (unlockResponse.status === 401) {
        console.log(`\n${colors.yellow}   ℹ️ Authentication required. The API needs a valid JWT token.${colors.reset}`);
        console.log('   In production, this would be handled by the frontend auth.');
      }
    }
  } catch (error: any) {
    console.log(`${colors.red}   ❌ Failed to call API:${colors.reset}`);
    console.log(`   ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log(`\n${colors.yellow}   ℹ️ Backend server is not running.${colors.reset}`);
      console.log('   Start it with: npm run dev');
    }
  }

  // Alternative: Test using the service directly
  console.log(`\n${colors.blue}🔧 Step 3: Testing UniFi service directly...${colors.reset}`);
  
  try {
    // Import the service directly
    const unifiCloudService = (await import('../src/services/unifiCloudService')).default;
    
    console.log(`   Demo mode: ${unifiCloudService.isInDemoMode() ? 'Yes' : 'No'}`);
    
    // Get doors for Dartmouth
    const doors = await unifiCloudService.getDoors('Dartmouth');
    console.log(`   Available doors at Dartmouth:`, doors);
    
    // Try to unlock
    console.log(`\n   Attempting direct service unlock...`);
    const unlockResult = await unifiCloudService.unlockDoor('Dartmouth', 'staff-door', 5);
    
    if (unlockResult.success) {
      console.log(`${colors.green}   ✓ Service unlock successful!${colors.reset}`);
      console.log(`   Message: ${unlockResult.message}`);
    } else {
      console.log(`${colors.red}   ✗ Service unlock failed: ${unlockResult.message}${colors.reset}`);
    }
    
  } catch (error: any) {
    console.log(`${colors.red}   ❌ Service test failed:${colors.reset}`);
    console.log(`   ${error.message}`);
  }

  console.log(`\n${colors.cyan}════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}✅ Test completed!${colors.reset}`);
  console.log('\nPlease confirm if the door physically unlocked during the test.');
  console.log('If the door did not unlock, check the following:');
  console.log('1. UniFi Remote Access is enabled in the controller');
  console.log('2. The API token is valid and has door control permissions');
  console.log('3. The console ID matches your UniFi controller');
  console.log('4. Port forwarding or Cloudflare Tunnel is configured if needed\n');
}

// Run the test
console.log('Starting UniFi Access API test...');
testUnifiDoorViaAPI().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});