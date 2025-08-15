#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import unifiCloudService from '../src/services/unifiCloudService';

// Load environment variables
dotenv.config();

console.log('========================================');
console.log('UniFi Cloud Connection Test');
console.log('========================================\n');

// Check configuration
const cloudUsername = process.env.UNIFI_CLOUD_USERNAME;
const cloudPassword = process.env.UNIFI_CLOUD_PASSWORD;
const consoleId = process.env.UNIFI_CONSOLE_ID;

const directUrl = process.env.UNIFI_CONTROLLER_URL;
const directUsername = process.env.UNIFI_USERNAME;
const directPassword = process.env.UNIFI_PASSWORD;

if (cloudUsername && cloudPassword && consoleId) {
  console.log('✅ Cloud configuration detected:');
  console.log(`   Username: ${cloudUsername}`);
  console.log(`   Console ID: ${consoleId}`);
  console.log(`   Mode: Cloud Proxy via unifi.ui.com\n`);
} else if (directUrl && directUsername && directPassword) {
  console.log('✅ Direct controller configuration detected:');
  console.log(`   Controller URL: ${directUrl}`);
  console.log(`   Username: ${directUsername}`);
  console.log(`   Mode: Direct Connection\n`);
} else {
  console.log('⚠️  No UniFi configuration detected');
  console.log('   Running in DEMO mode\n');
  console.log('To enable cloud access, set these environment variables:');
  console.log('   UNIFI_CLOUD_USERNAME=your-ubiquiti-account@email.com');
  console.log('   UNIFI_CLOUD_PASSWORD=your-password');
  console.log('   UNIFI_CONSOLE_ID=your-console-id\n');
  console.log('To enable direct access, set these environment variables:');
  console.log('   UNIFI_CONTROLLER_URL=https://your-controller:12445');
  console.log('   UNIFI_USERNAME=your-username');
  console.log('   UNIFI_PASSWORD=your-password\n');
}

async function testConnection() {
  try {
    console.log('Testing connection...\n');
    
    // Test if in demo mode
    if (unifiCloudService.isInDemoMode()) {
      console.log('🎮 Running in DEMO mode');
      console.log('   All features work but doors are simulated\n');
    } else {
      console.log('🔌 Connected to UniFi Access API\n');
    }
    
    // Test getting door status for Bedford
    console.log('Testing door status for Bedford location...');
    const bedfordStatus = await unifiCloudService.getDoorStatus('Bedford');
    
    console.log('\nBedford doors:');
    for (const door of bedfordStatus) {
      const status = door.locked ? '🔒 Locked' : '🔓 Unlocked';
      const online = door.online ? '✅ Online' : '❌ Offline';
      console.log(`   ${door.name}: ${status} | ${online} | Battery: ${door.battery || 'N/A'}%`);
    }
    
    // Test getting door status for Dartmouth
    console.log('\nTesting door status for Dartmouth location...');
    const dartmouthStatus = await unifiCloudService.getDoorStatus('Dartmouth');
    
    console.log('\nDartmouth doors:');
    for (const door of dartmouthStatus) {
      const status = door.locked ? '🔒 Locked' : '🔓 Unlocked';
      const online = door.online ? '✅ Online' : '❌ Offline';
      console.log(`   ${door.name}: ${status} | ${online} | Battery: ${door.battery || 'N/A'}%`);
    }
    
    // Test unlock (in demo mode this is safe)
    if (unifiCloudService.isInDemoMode()) {
      console.log('\n\nTesting door unlock (DEMO mode - safe to test)...');
      const unlockResult = await unifiCloudService.unlockDoor('Bedford', 'staff-door', 5);
      console.log(`   Result: ${unlockResult.message}`);
    }
    
    console.log('\n========================================');
    console.log('Test Complete!');
    console.log('========================================\n');
    
    if (unifiCloudService.isInDemoMode()) {
      console.log('Next steps to enable real door control:');
      console.log('1. Add cloud credentials to .env (see above)');
      console.log('2. Get console ID from UniFi web interface');
      console.log('3. Get actual door IDs from UniFi Access');
      console.log('4. Update door IDs in environment variables\n');
    } else {
      console.log('✅ UniFi Access is connected and ready!');
      console.log('   Door controls are LIVE - be careful!\n');
    }
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('\nFull error:', error);
  }
}

// Run the test
testConnection().catch(console.error);