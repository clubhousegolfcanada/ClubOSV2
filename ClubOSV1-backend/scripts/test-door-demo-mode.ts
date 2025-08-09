#!/usr/bin/env npx tsx

/**
 * Test Door Access in Demo Mode
 * This verifies the door access system works even without UniFi connection
 */

import * as dotenv from 'dotenv';
import express from 'express';
import request from 'supertest';

// Load environment variables
dotenv.config();

// Import the service
import unifiAccessService from '../src/services/unifiAccess';

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function testDemoMode() {
  console.log(`${colors.blue}===================================`);
  console.log('Door Access Demo Mode Test');
  console.log(`===================================${colors.reset}\n`);

  // Wait for service initialization
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log(`${colors.yellow}Running in Demo Mode${colors.reset}`);
  console.log('This allows testing without UniFi connection\n');

  // Test 1: Check demo mode status
  console.log('Test 1: Verify Demo Mode is active');
  const isDemoMode = unifiAccessService.isInDemoMode();
  if (isDemoMode) {
    console.log(`${colors.green}✓ Demo mode is active${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Demo mode is NOT active (UniFi connected?)${colors.reset}`);
  }
  console.log('');

  // Test 2: Get configured doors for each location
  console.log('Test 2: Check configured doors');
  const locations = ['Bedford', 'Dartmouth', 'Stratford', 'Bayers Lake', 'Truro'];
  
  for (const location of locations) {
    const doors = unifiAccessService.getLocationDoors(location);
    if (doors.length > 0) {
      console.log(`${colors.green}${location}: ${doors.length} doors configured${colors.reset}`);
      doors.forEach(door => {
        console.log(`  - ${door.name} (${door.type}) [${door.doorId}]`);
      });
    } else {
      console.log(`${colors.yellow}${location}: No doors found${colors.reset}`);
    }
  }
  console.log('');

  // Test 3: Get door status (demo data)
  console.log('Test 3: Get door status for Bedford');
  try {
    const status = await unifiAccessService.getDoorStatus('Bedford');
    console.log(`${colors.green}✓ Retrieved status for ${status.length} doors${colors.reset}`);
    status.forEach(door => {
      const lockStatus = door.locked ? '🔒 Locked' : '🔓 Unlocked';
      const onlineStatus = door.online ? '✅ Online' : '❌ Offline';
      console.log(`  ${door.name}: ${lockStatus}, ${onlineStatus}`);
      if (door.battery) {
        console.log(`    Battery: ${door.battery}%`);
      }
    });
  } catch (error: any) {
    console.log(`${colors.red}✗ Failed to get door status: ${error.message}${colors.reset}`);
  }
  console.log('');

  // Test 4: Simulate door unlock
  console.log('Test 4: Simulate unlocking Bedford staff door');
  try {
    const result = await unifiAccessService.unlockDoor('Bedford', 'staff-door', 5);
    if (result.success) {
      console.log(`${colors.green}✓ ${result.message}${colors.reset}`);
      console.log(`  Door ID: ${result.doorId}`);
      console.log(`  Duration: ${result.unlockDuration} seconds`);
    } else {
      console.log(`${colors.red}✗ Unlock failed${colors.reset}`);
    }
  } catch (error: any) {
    console.log(`${colors.red}✗ Error: ${error.message}${colors.reset}`);
  }
  console.log('');

  // Test 5: Simulate door lock
  console.log('Test 5: Simulate locking Bedford staff door');
  try {
    const result = await unifiAccessService.lockDoor('Bedford', 'staff-door');
    if (result.success) {
      console.log(`${colors.green}✓ ${result.message}${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Lock failed${colors.reset}`);
    }
  } catch (error: any) {
    console.log(`${colors.red}✗ Error: ${error.message}${colors.reset}`);
  }
  console.log('');

  // Test 6: Get access logs (demo data)
  console.log('Test 6: Get access logs');
  try {
    const logs = await unifiAccessService.getAccessLog('Bedford', 'staff-door', 5);
    console.log(`${colors.green}✓ Retrieved ${logs.length} access log entries${colors.reset}`);
    logs.forEach(log => {
      console.log(`  ${log.timestamp.toISOString()}: ${log.event} - ${log.user}`);
    });
  } catch (error: any) {
    console.log(`${colors.red}✗ Error: ${error.message}${colors.reset}`);
  }
  console.log('');

  // Test 7: Emergency unlock all
  console.log('Test 7: Simulate emergency unlock all doors');
  try {
    const results = await unifiAccessService.unlockAllDoors('Dartmouth', 60);
    console.log(`${colors.green}✓ Emergency unlock executed${colors.reset}`);
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`  ${status} ${result.message || result.doorId}`);
    });
  } catch (error: any) {
    console.log(`${colors.red}✗ Error: ${error.message}${colors.reset}`);
  }
  console.log('');

  // Summary
  console.log(`${colors.blue}===================================`);
  console.log('Demo Mode Test Complete');
  console.log(`===================================${colors.reset}\n`);

  if (isDemoMode) {
    console.log(`${colors.yellow}System is running in DEMO mode${colors.reset}`);
    console.log('All door functions work but don\'t control real doors.');
    console.log('\nTo connect to real UniFi controllers:');
    console.log('1. Set up remote access (see UNIFI-REMOTE-ACCESS-SETUP.md)');
    console.log('2. Update UNIFI_CONTROLLER_URL in .env');
    console.log('3. Restart the backend\n');
  } else {
    console.log(`${colors.green}System is connected to UniFi${colors.reset}`);
    console.log('Door controls will affect real devices.\n');
  }

  console.log('The UI will work regardless of UniFi connection.');
  console.log('Demo mode is perfect for development and testing.\n');
}

// Run the test
testDemoMode().catch(error => {
  console.error(`${colors.red}Test failed:${colors.reset}`, error);
  process.exit(1);
});