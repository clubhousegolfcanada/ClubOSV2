#!/usr/bin/env npx tsx
import fetch from 'node-fetch';
import https from 'https';
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
  cyan: '\x1b[36m'
};

// Ignore self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

async function testDartmouthDoorUnlock() {
  console.log(`\n${colors.cyan}╔══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║        🔓 Dartmouth UniFi Access Door Test 🔓           ║${colors.reset}`);
  console.log(`${colors.cyan}╚══════════════════════════════════════════════════════════╝${colors.reset}\n`);

  // Get configuration from environment
  const token = process.env.DARTMOUTH_ACCESS_TOKEN || process.env.UNIFI_ACCESS_TOKEN;
  const controllerIP = process.env.DARTMOUTH_CONTROLLER_IP || '192.168.2.103';
  const apiPort = process.env.DARTMOUTH_API_PORT || '12445';
  
  console.log(`${colors.blue}📋 Configuration:${colors.reset}`);
  console.log(`   Token: ${token ? `${colors.green}✓${colors.reset} ${token.substring(0, 10)}...` : `${colors.red}✗ NOT FOUND${colors.reset}`}`);
  console.log(`   Controller IP: ${controllerIP}`);
  console.log(`   API Port: ${apiPort}`);
  console.log(`   Full URL: https://${controllerIP}:${apiPort}/api/v1/developer/doors\n`);

  if (!token) {
    console.log(`${colors.red}❌ Error: No API token found in environment variables${colors.reset}`);
    console.log('   Please ensure DARTMOUTH_ACCESS_TOKEN is set in .env file');
    process.exit(1);
  }

  try {
    // Step 1: Test connection and list doors
    console.log(`${colors.yellow}🔍 Step 1: Testing API connection and listing doors...${colors.reset}`);
    
    const doorsUrl = `https://${controllerIP}:${apiPort}/api/v1/developer/doors`;
    console.log(`   Fetching: ${doorsUrl}`);
    
    const doorsResponse = await fetch(doorsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      agent: httpsAgent,
      timeout: 10000
    });

    if (!doorsResponse.ok) {
      const errorText = await doorsResponse.text();
      console.log(`${colors.red}   ✗ Failed to connect: ${doorsResponse.status} ${doorsResponse.statusText}${colors.reset}`);
      console.log(`   Response: ${errorText}`);
      
      // Check if it's a connection error
      if (doorsResponse.status === 0 || !doorsResponse.status) {
        console.log(`\n${colors.yellow}💡 Troubleshooting Tips:${colors.reset}`);
        console.log('   1. Ensure port forwarding is set up (port 12445 → 443)');
        console.log('   2. Check if Cloudflare Tunnel is running if using it');
        console.log('   3. Verify the controller IP is correct');
        console.log('   4. Try accessing locally first if possible');
      }
      
      process.exit(1);
    }

    const doorsData = await doorsResponse.json();
    
    if (doorsData.code !== 'SUCCESS') {
      console.log(`${colors.red}   ✗ API returned error: ${doorsData.msg || 'Unknown error'}${colors.reset}`);
      process.exit(1);
    }

    console.log(`${colors.green}   ✓ Connected successfully!${colors.reset}`);
    console.log(`   Found ${doorsData.data?.length || 0} door(s):\n`);

    // List all doors
    const doors = doorsData.data || [];
    let officeDoor = null;
    
    doors.forEach((door: any, index: number) => {
      const isOffice = door.name?.toLowerCase().includes('office') || 
                       door.full_name?.toLowerCase().includes('office');
      
      if (isOffice) {
        officeDoor = door;
      }
      
      console.log(`   ${index + 1}. ${door.name || door.full_name || 'Unnamed Door'}`);
      console.log(`      ID: ${door.id}`);
      console.log(`      Status: ${door.door_lock_relay_status === 'lock' ? '🔒 Locked' : '🔓 Unlocked'}`);
      console.log(`      Position: ${door.door_position_status || 'Unknown'}`);
      if (isOffice) {
        console.log(`      ${colors.green}→ This appears to be the Office door${colors.reset}`);
      }
      console.log('');
    });

    if (doors.length === 0) {
      console.log(`${colors.yellow}   ⚠️ No doors found. The API connection works but no doors are configured.${colors.reset}`);
      process.exit(0);
    }

    // Step 2: Try to unlock the office door (or first door if no office door found)
    const doorToUnlock = officeDoor || doors[0];
    
    console.log(`${colors.yellow}🔓 Step 2: Testing door unlock...${colors.reset}`);
    console.log(`   Target: ${doorToUnlock.name || doorToUnlock.full_name}`);
    console.log(`   Door ID: ${doorToUnlock.id}`);
    console.log(`   Duration: 5 seconds (test unlock)\n`);

    console.log(`${colors.cyan}   ⚠️  READY TO UNLOCK - Monitor the door now!${colors.reset}`);
    console.log('   Press Enter to unlock or Ctrl+C to cancel...');
    
    // Wait for user input
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    const unlockUrl = `https://${controllerIP}:${apiPort}/api/v1/developer/doors/${doorToUnlock.id}/remote_unlock`;
    
    console.log(`${colors.yellow}   Sending unlock command...${colors.reset}`);
    
    const unlockResponse = await fetch(unlockUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        actor_id: 'clubos-test',
        actor_name: 'ClubOS Test Script',
        extra: {
          source: 'test-script',
          duration_seconds: 5,
          timestamp: new Date().toISOString()
        }
      }),
      agent: httpsAgent,
      timeout: 10000
    });

    if (!unlockResponse.ok) {
      const errorText = await unlockResponse.text();
      console.log(`${colors.red}   ✗ Unlock failed: ${unlockResponse.status} ${unlockResponse.statusText}${colors.reset}`);
      console.log(`   Response: ${errorText}`);
      process.exit(1);
    }

    const unlockData = await unlockResponse.json();
    
    if (unlockData.code === 'SUCCESS') {
      console.log(`${colors.green}   ✓ UNLOCK COMMAND SENT SUCCESSFULLY!${colors.reset}`);
      console.log('   The door should be unlocked now for 5 seconds.');
      console.log(`   ${colors.yellow}Please check if the door actually unlocked!${colors.reset}\n`);
      
      // Wait a moment then check status
      console.log('   Waiting 2 seconds before checking status...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check door status
      const statusResponse = await fetch(doorsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        agent: httpsAgent,
        timeout: 10000
      });
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const updatedDoor = statusData.data?.find((d: any) => d.id === doorToUnlock.id);
        
        if (updatedDoor) {
          console.log(`   Current Status: ${updatedDoor.door_lock_relay_status === 'lock' ? '🔒 Locked' : '🔓 Unlocked'}`);
        }
      }
    } else {
      console.log(`${colors.red}   ✗ Unlock failed: ${unlockData.msg || 'Unknown error'}${colors.reset}`);
    }

  } catch (error: any) {
    console.log(`${colors.red}❌ Connection Error:${colors.reset}`);
    console.log(`   ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log(`\n${colors.yellow}💡 Connection refused. Possible issues:${colors.reset}`);
      console.log('   1. Port forwarding not set up (need to forward port 12445 → 443)');
      console.log('   2. Cloudflare Tunnel not running');
      console.log('   3. UniFi controller not accessible from this network');
      console.log('   4. Firewall blocking the connection');
    } else if (error.code === 'ETIMEDOUT') {
      console.log(`\n${colors.yellow}💡 Connection timed out. Possible issues:${colors.reset}`);
      console.log('   1. Controller IP is incorrect');
      console.log('   2. Network routing issue');
      console.log('   3. VPN or tunnel not connected');
    }
    
    process.exit(1);
  }

  console.log(`\n${colors.green}✅ Test completed!${colors.reset}`);
  console.log('Please confirm if the door physically unlocked when the command was sent.\n');
}

// Run the test
console.log('Starting UniFi Access test...');
testDartmouthDoorUnlock().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});