#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import { logger } from '../src/utils/logger';

// Load environment variables
dotenv.config();

console.log('========================================');
console.log('UniFi Access - Testing All Approaches');
console.log('========================================\n');

// Check what's configured
const configs = {
  tailscale: {
    configured: !!(process.env.BEDFORD_CONTROLLER_IP || process.env.DARTMOUTH_CONTROLLER_IP),
    bedfordIp: process.env.BEDFORD_CONTROLLER_IP,
    dartmouthIp: process.env.DARTMOUTH_CONTROLLER_IP,
    username: process.env.UNIFI_USERNAME,
    password: process.env.UNIFI_PASSWORD ? '***' : undefined
  },
  mobile: {
    configured: !!process.env.UNIFI_MOBILE_TOKEN,
    token: process.env.UNIFI_MOBILE_TOKEN ? '***' + process.env.UNIFI_MOBILE_TOKEN.slice(-4) : undefined
  },
  network: {
    configured: !!process.env.UNIFI_USE_NETWORK_API,
    consoleId: process.env.UNIFI_CONSOLE_ID,
    doorMacs: {
      bedfordMain: process.env.BEDFORD_MAIN_DOOR_MAC,
      bedfordStaff: process.env.BEDFORD_STAFF_DOOR_MAC,
      dartmouthMain: process.env.DARTMOUTH_MAIN_DOOR_MAC,
      dartmouthStaff: process.env.DARTMOUTH_STAFF_DOOR_MAC,
      dartmouthBay: process.env.DARTMOUTH_BAY_DOOR_MAC
    }
  },
  cloud: {
    configured: !!(process.env.UNIFI_CLOUD_USERNAME && process.env.UNIFI_CLOUD_PASSWORD),
    username: process.env.UNIFI_CLOUD_USERNAME,
    consoleId: process.env.UNIFI_CONSOLE_ID
  }
};

// Report configuration status
console.log('📋 Configuration Status:\n');

if (configs.tailscale.configured) {
  console.log('✅ Tailscale Direct Connection:');
  console.log(`   Bedford: ${configs.tailscale.bedfordIp || 'Not configured'}`);
  console.log(`   Dartmouth: ${configs.tailscale.dartmouthIp || 'Not configured'}`);
  console.log(`   Username: ${configs.tailscale.username}`);
  console.log(`   Password: ${configs.tailscale.password}\n`);
} else {
  console.log('❌ Tailscale: Not configured\n');
}

if (configs.mobile.configured) {
  console.log('✅ Mobile API:');
  console.log(`   Token: ${configs.mobile.token}\n`);
} else {
  console.log('❌ Mobile API: Not configured\n');
}

if (configs.network.configured) {
  console.log('✅ Network Console Devices:');
  console.log(`   Console ID: ${configs.network.consoleId}`);
  console.log('   Configured doors:');
  Object.entries(configs.network.doorMacs).forEach(([key, mac]) => {
    if (mac) console.log(`     ${key}: ${mac}`);
  });
  console.log('');
} else {
  console.log('❌ Network Console: Not configured\n');
}

if (configs.cloud.configured) {
  console.log('⚠️  Cloud API (blocked by CloudFront):');
  console.log(`   Username: ${configs.cloud.username}`);
  console.log(`   Console ID: ${configs.cloud.consoleId}\n`);
}

// Test the configured approaches
async function testApproaches() {
  console.log('========================================');
  console.log('Testing Available Approaches');
  console.log('========================================\n');

  // Import the appropriate service
  let service: any;

  try {
    if (configs.tailscale.configured || configs.mobile.configured || configs.network.configured) {
      const { default: unifiService } = await import('../src/services/unifiNetworkAccessService');
      service = unifiService;
      console.log('Using UnifiNetworkAccessService (supports Tailscale/Mobile/Network)\n');
    } else {
      const { default: unifiService } = await import('../src/services/unifiCloudService');
      service = unifiService;
      console.log('Using UnifiCloudService (cloud/demo mode)\n');
    }

    // Test door status
    console.log('Testing door status retrieval...');
    const bedfordStatus = await service.getDoorStatus('Bedford');
    
    if (service.isInDemoMode()) {
      console.log('🎮 Running in DEMO mode\n');
    } else {
      console.log('🔌 Connected to real UniFi system\n');
    }

    console.log('Bedford doors:');
    bedfordStatus.forEach(door => {
      const locked = door.locked ? '🔒' : '🔓';
      const online = door.online ? '✅' : '❌';
      console.log(`  ${door.name}: ${locked} ${online} Battery: ${door.battery}%`);
    });

    // Test unlock (safe in demo mode)
    if (service.isInDemoMode()) {
      console.log('\nTesting door unlock (DEMO - safe)...');
      const result = await service.unlockDoor('Bedford', 'staff-door', 5);
      console.log(`Result: ${result.message}`);
    }

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
  }
}

// Provide setup instructions based on what's missing
function provideNextSteps() {
  console.log('\n========================================');
  console.log('Recommended Next Steps');
  console.log('========================================\n');

  if (!configs.tailscale.configured && !configs.mobile.configured && !configs.network.configured) {
    console.log('📱 Quick Win: Mobile API Setup');
    console.log('1. Open UniFi Access app');
    console.log('2. Settings > tap version 7 times > Developer Mode');
    console.log('3. Developer > Show Token');
    console.log('4. Add to .env: UNIFI_MOBILE_TOKEN=<token>\n');

    console.log('🌐 Most Reliable: Tailscale Setup');
    console.log('1. Install Tailscale at each location:');
    console.log('   curl -fsSL https://tailscale.com/install.sh | sh');
    console.log('2. Get Tailscale IPs (100.x.x.x)');
    console.log('3. Add to .env:');
    console.log('   BEDFORD_CONTROLLER_IP=100.x.x.x');
    console.log('   DARTMOUTH_CONTROLLER_IP=100.x.x.x\n');

    console.log('🔍 Network Console Setup');
    console.log('1. Log into https://unifi.ui.com');
    console.log('2. Find door devices in Devices list');
    console.log('3. Note MAC addresses');
    console.log('4. Add to .env:');
    console.log('   BEDFORD_STAFF_DOOR_MAC=aa:bb:cc:dd:ee:ff');
    console.log('   UNIFI_USE_NETWORK_API=true\n');
  } else {
    console.log('✅ You have at least one approach configured!');
    
    if (!configs.tailscale.configured) {
      console.log('\n💡 Consider adding Tailscale for redundancy:');
      console.log('   - Most reliable connection');
      console.log('   - Works even if cloud is down');
      console.log('   - 15-minute setup');
    }

    if (!configs.mobile.configured) {
      console.log('\n💡 Consider adding Mobile API token:');
      console.log('   - Good backup option');
      console.log('   - Uses same auth as mobile app');
      console.log('   - No network setup required');
    }
  }
}

// Run tests
console.log('Starting tests...\n');
testApproaches().then(() => {
  provideNextSteps();
}).catch(console.error);