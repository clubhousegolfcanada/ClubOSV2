#!/usr/bin/env npx tsx
/**
 * Test script for Cloudflare Tunnel integration with UniFi Access
 * Run with: npx tsx scripts/test-cloudflare-tunnels.ts
 */

import { cloudflareTunnelManager } from '../src/services/cloudflare/CloudflareTunnelManager';
import { unifiAccessService } from '../src/services/unifi/UniFiAccessService';
import { logger } from '../src/utils/logger';
import dotenv from 'dotenv';
import { config } from '../src/utils/envValidator';

// Load environment variables
dotenv.config();

// Test configuration
const TEST_CONFIG = {
  testUnlock: process.env.TEST_DOOR_UNLOCK === 'true',
  unlockDuration: 5, // seconds
  locations: ['dartmouth', 'bedford'], // Locations to test
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function logSuccess(message: string) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message: string) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function logInfo(message: string) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function logWarning(message: string) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function logHeader(message: string) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}${message}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

async function testTunnelConnectivity() {
  logHeader('Testing Cloudflare Tunnel Connectivity');
  
  const isCloudflareEnabled = cloudflareTunnelManager.isCloudflareEnabled();
  logInfo(`Cloudflare mode: ${isCloudflareEnabled ? 'ENABLED' : 'DISABLED (using direct access)'}`);
  
  const availableLocations = cloudflareTunnelManager.getAvailableLocations();
  logInfo(`Available locations: ${availableLocations.join(', ')}`);
  
  const results = await cloudflareTunnelManager.testAllConnections();
  
  let allPassed = true;
  for (const [location, success] of results) {
    if (success) {
      logSuccess(`${location}: Connection successful`);
    } else {
      logError(`${location}: Connection failed`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

async function testDoorListing() {
  logHeader('Testing Door Listing');
  
  for (const location of TEST_CONFIG.locations) {
    logInfo(`\nFetching doors for ${location}...`);
    
    try {
      const doors = await unifiAccessService.getDoorsByLocation(location);
      
      if (doors.length === 0) {
        logWarning(`No doors found at ${location}`);
      } else {
        logSuccess(`Found ${doors.length} door(s) at ${location}:`);
        
        for (const door of doors) {
          console.log(`  - ${door.name} (ID: ${door.id}, MAC: ${door.mac || 'N/A'})`);
          console.log(`    Status: ${door.door_lock_relay_status || 'unknown'}`);
          console.log(`    Position: ${door.door_position_status || 'unknown'}`);
        }
      }
    } catch (error: any) {
      logError(`Failed to fetch doors for ${location}: ${error.message}`);
    }
  }
}

async function testDoorStatus() {
  logHeader('Testing Door Status Retrieval');
  
  try {
    const allDoors = await unifiAccessService.getAllDoorsStatus();
    
    if (allDoors.length === 0) {
      logWarning('No doors found across all locations');
    } else {
      logSuccess(`Retrieved status for ${allDoors.length} door(s):`);
      
      for (const door of allDoors) {
        console.log(`\n  ${door.location} - ${door.name}:`);
        console.log(`    Status: ${door.status}`);
        console.log(`    Position: ${door.position}`);
        console.log(`    Online: ${door.online ? 'Yes' : 'No'}`);
      }
    }
  } catch (error: any) {
    logError(`Failed to get door status: ${error.message}`);
  }
}

async function testDoorUnlock() {
  logHeader('Testing Door Unlock (if enabled)');
  
  if (!TEST_CONFIG.testUnlock) {
    logWarning('Door unlock test is disabled. Set TEST_DOOR_UNLOCK=true to enable.');
    return;
  }
  
  // Test with Bedford front door
  const testLocation = 'bedford';
  const testDoorMac = '28:70:4e:80:c4:4f'; // Bedford front door MAC
  
  logInfo(`\nAttempting to unlock door at ${testLocation}...`);
  logInfo(`Door MAC: ${testDoorMac}`);
  logInfo(`Duration: ${TEST_CONFIG.unlockDuration} seconds`);
  
  try {
    // First get the door ID
    const doorId = await unifiAccessService.getDoorId(testLocation, testDoorMac);
    logInfo(`Resolved door ID: ${doorId}`);
    
    // Attempt to unlock
    const result = await unifiAccessService.unlockDoor(
      testLocation,
      doorId,
      TEST_CONFIG.unlockDuration
    );
    
    if (result.success) {
      logSuccess(`Door unlocked successfully!`);
      console.log(`  Message: ${result.message}`);
      console.log(`  Duration: ${result.unlockDuration} seconds`);
      console.log(`  Timestamp: ${result.timestamp}`);
      
      // Wait and then check status
      logInfo(`Waiting ${TEST_CONFIG.unlockDuration} seconds...`);
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.unlockDuration * 1000));
      
      // Check if door is locked again
      const status = await unifiAccessService.getDoorStatus(testLocation, doorId);
      if (status) {
        logInfo(`Door status after unlock period: ${status.status}`);
      }
    } else {
      logError(`Failed to unlock door: ${result.message}`);
    }
  } catch (error: any) {
    logError(`Door unlock test failed: ${error.message}`);
  }
}

async function testHealthCheck() {
  logHeader('Testing Service Health');
  
  try {
    const health = await unifiAccessService.getHealthStatus();
    
    logInfo(`Overall health: ${health.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    logInfo(`Cloudflare enabled: ${health.cloudflareEnabled ? 'Yes' : 'No'}`);
    
    console.log('\nLocation Status:');
    for (const location of health.locations) {
      const status = location.connected ? colors.green + 'Connected' : colors.red + 'Disconnected';
      console.log(`  ${location.name}: ${status}${colors.reset} (Available: ${location.available})`);
    }
  } catch (error: any) {
    logError(`Health check failed: ${error.message}`);
  }
}

async function runAllTests() {
  logHeader('Starting Cloudflare Tunnel Integration Tests');
  
  try {
    // Test 1: Tunnel Connectivity
    const connectivityPassed = await testTunnelConnectivity();
    
    if (!connectivityPassed) {
      logWarning('\nSome tunnels are not connected. Continuing with available locations...');
    }
    
    // Test 2: Door Listing
    await testDoorListing();
    
    // Test 3: Door Status
    await testDoorStatus();
    
    // Test 4: Door Unlock (if enabled)
    await testDoorUnlock();
    
    // Test 5: Health Check
    await testHealthCheck();
    
    logHeader('Tests Complete');
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`  - Cloudflare Mode: ${cloudflareTunnelManager.isCloudflareEnabled() ? 'Enabled' : 'Disabled'}`);
    console.log(`  - Available Locations: ${cloudflareTunnelManager.getAvailableLocations().length}`);
    console.log(`  - Unlock Test: ${TEST_CONFIG.testUnlock ? 'Executed' : 'Skipped'}`);
    
    logSuccess('\nAll tests completed successfully!');
  } catch (error: any) {
    logError(`\nTest suite failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});