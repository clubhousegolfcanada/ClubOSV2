#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import { logger } from '../src/utils/logger';

// Load environment variables
dotenv.config();

console.log('========================================');
console.log('Testing Real Door Control');
console.log('========================================\n');

// Check configuration
const configs = {
  doors: {
    bedfordMain: process.env.BEDFORD_MAIN_DOOR_MAC || '',
    bedfordMiddle: process.env.BEDFORD_MIDDLE_DOOR_MAC || '',
    dartmouthStaff: process.env.DARTMOUTH_STAFF_DOOR_MAC || ''
  },
  network: {
    useNetworkApi: process.env.UNIFI_USE_NETWORK_API === 'true',
    controllerUrl: process.env.UNIFI_CONTROLLER_URL,
    username: process.env.UNIFI_USERNAME,
    password: process.env.UNIFI_PASSWORD ? '***' : undefined
  },
  cloud: {
    consoleId: process.env.UNIFI_CONSOLE_ID,
    cloudUsername: process.env.UNIFI_CLOUD_USERNAME,
    cloudPassword: process.env.UNIFI_CLOUD_PASSWORD ? '***' : undefined
  }
};

console.log('📋 Configuration Check:\n');

console.log('Configured Doors:');
console.log(`  Bedford Front:  ${configs.doors.bedfordMain}`);
console.log(`  Bedford Middle: ${configs.doors.bedfordMiddle}`);
console.log(`  Dartmouth Staff: ${configs.doors.dartmouthStaff}\n`);

console.log('Connection Settings:');
console.log(`  Controller URL: ${configs.network.controllerUrl}`);
console.log(`  Username: ${configs.network.username}`);
console.log(`  Password: ${configs.network.password}`);
console.log(`  Network API: ${configs.network.useNetworkApi}\n`);

// The issue: 192.168.1.1 is a local IP, not accessible remotely
if (configs.network.controllerUrl?.includes('192.168.') || configs.network.controllerUrl?.includes('10.')) {
  console.log('⚠️  WARNING: Controller URL uses local IP address');
  console.log('   This won\'t work from outside the local network!\n');
  console.log('   Options to fix this:');
  console.log('   1. Use Tailscale VPN (recommended)');
  console.log('   2. Use port forwarding + dynamic DNS');
  console.log('   3. Use UniFi Cloud access\n');
}

// Test with the cloud service that supports MAC-based control
async function testDoorControl() {
  try {
    console.log('========================================');
    console.log('Testing Door Service');
    console.log('========================================\n');

    // Import the service
    const { default: doorService } = await import('../src/services/unifiCloudService');
    
    // Check if in demo mode
    if (doorService.isInDemoMode()) {
      console.log('🎮 System is in DEMO mode\n');
      console.log('To enable real control, you need:');
      console.log('1. A way to reach the controller (not local IP)');
      console.log('2. Or UniFi Cloud credentials');
      console.log('3. Or Mobile API token\n');
    } else {
      console.log('✅ System is connected to UniFi!\n');
    }

    // Test door status
    console.log('Getting door status for Bedford...');
    const bedfordStatus = await doorService.getDoorStatus('Bedford');
    
    console.log('\nBedford Doors:');
    bedfordStatus.forEach(door => {
      const status = door.locked ? '🔒 Locked' : '🔓 Unlocked';
      const online = door.online ? '✅ Online' : '❌ Offline';
      console.log(`  ${door.name}: ${status} | ${online}`);
    });

    // Test unlock (only if NOT in demo mode)
    if (!doorService.isInDemoMode()) {
      console.log('\n⚠️  REAL DOOR CONTROL ACTIVE!');
      console.log('Would you like to test unlock a door? (This will actually unlock it!)');
      console.log('Skipping automatic unlock for safety.\n');
      console.log('To test manually, run:');
      console.log('  await doorService.unlockDoor("Bedford", "main-entrance", 5);\n');
    } else {
      console.log('\nTesting unlock in DEMO mode...');
      const result = await doorService.unlockDoor('Bedford', 'main-entrance', 5);
      console.log(`Result: ${result.message}\n`);
    }

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
  }
}

// Provide solutions
function provideSolutions() {
  console.log('========================================');
  console.log('How to Enable Real Door Control');
  console.log('========================================\n');

  console.log('Option 1: Tailscale (Easiest - 15 minutes)');
  console.log('------------------------------------------');
  console.log('1. Install Tailscale where the controller is:');
  console.log('   curl -fsSL https://tailscale.com/install.sh | sh');
  console.log('   sudo tailscale up\n');
  console.log('2. Note the Tailscale IP (like 100.x.x.x)\n');
  console.log('3. Update .env:');
  console.log('   UNIFI_CONTROLLER_URL=https://100.x.x.x:8443\n');

  console.log('Option 2: Port Forwarding');
  console.log('-------------------------');
  console.log('1. Forward port 8443 on your router');
  console.log('2. Get your public IP or use dynamic DNS');
  console.log('3. Update .env:');
  console.log('   UNIFI_CONTROLLER_URL=https://your-public-ip:8443\n');

  console.log('Option 3: UniFi Cloud');
  console.log('---------------------');
  console.log('1. Enable Remote Access in UniFi settings');
  console.log('2. Update .env:');
  console.log('   UNIFI_CLOUD_USERNAME=your-email@example.com');
  console.log('   UNIFI_CLOUD_PASSWORD=your-password');
  console.log('   UNIFI_CONSOLE_ID=' + (process.env.UNIFI_CONSOLE_ID || 'your-console-id') + '\n');

  console.log('Option 4: Mobile API Token');
  console.log('--------------------------');
  console.log('1. Open UniFi Access mobile app');
  console.log('2. Settings → Tap version 7 times → Developer → Show Token');
  console.log('3. Update .env:');
  console.log('   UNIFI_MOBILE_TOKEN=<token>\n');
}

// Run the test
console.log('Starting test...\n');
testDoorControl().then(() => {
  provideSolutions();
}).catch(console.error);