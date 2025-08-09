#!/usr/bin/env npx tsx

/**
 * Test UniFi Access Connection
 * Run this script to verify your UniFi Access configuration
 */

import * as dotenv from 'dotenv';
import { logger } from '../src/utils/logger';

// Load environment variables
dotenv.config();

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function testUnifiConnection() {
  console.log(`${colors.blue}===================================`);
  console.log('UniFi Access Connection Test');
  console.log(`===================================${colors.reset}\n`);

  // Check environment variables
  const requiredVars = [
    'UNIFI_CONTROLLER_URL',
    'UNIFI_USERNAME',
    'UNIFI_PASSWORD'
  ];

  const missingVars = requiredVars.filter(v => !process.env[v] || process.env[v] === '');
  
  if (missingVars.length > 0) {
    console.log(`${colors.red}❌ Missing required environment variables:${colors.reset}`);
    missingVars.forEach(v => console.log(`   - ${v}`));
    console.log('\nPlease run: npm run setup:unifi');
    process.exit(1);
  }

  console.log(`${colors.green}✓ Environment variables configured${colors.reset}`);
  console.log(`  Controller: ${process.env.UNIFI_CONTROLLER_URL}`);
  console.log(`  Username: ${process.env.UNIFI_USERNAME}`);
  console.log(`  Site ID: ${process.env.UNIFI_SITE_ID || 'default'}\n`);

  // Check door configurations
  const locations = ['Bedford', 'Dartmouth', 'Stratford', 'Bayers Lake', 'Truro'];
  const doorTypes = ['MAIN', 'STAFF', 'EMERGENCY'];
  
  console.log('Door Configurations:');
  let configuredDoors = 0;
  let totalDoors = 0;

  for (const location of locations) {
    const prefix = location === 'Bayers Lake' ? 'BAYERS' : location.toUpperCase().replace(' ', '_');
    let locationDoors = [];
    
    for (const doorType of doorTypes) {
      const envKey = `${prefix}_${doorType}_DOOR_ID`;
      const doorId = process.env[envKey];
      totalDoors++;
      
      if (doorId && doorId !== '') {
        locationDoors.push(`${doorType}: ${doorId.substring(0, 8)}...`);
        configuredDoors++;
      }
    }
    
    // Check special doors
    if (location === 'Dartmouth') {
      const bayDoor = process.env.DARTMOUTH_BAY_DOOR_ID;
      totalDoors++;
      if (bayDoor && bayDoor !== '') {
        locationDoors.push(`BAY: ${bayDoor.substring(0, 8)}...`);
        configuredDoors++;
      }
    }
    
    if (location === 'Bayers Lake') {
      const loadingDoor = process.env.BAYERS_LOADING_DOOR_ID;
      totalDoors++;
      if (loadingDoor && loadingDoor !== '') {
        locationDoors.push(`LOADING: ${loadingDoor.substring(0, 8)}...`);
        configuredDoors++;
      }
    }
    
    if (locationDoors.length > 0) {
      console.log(`  ${colors.green}${location}:${colors.reset} ${locationDoors.join(', ')}`);
    }
  }
  
  console.log(`\n${configuredDoors}/${totalDoors} doors configured`);
  
  if (configuredDoors === 0) {
    console.log(`${colors.yellow}⚠ No doors configured - system will run in DEMO mode${colors.reset}`);
  }

  // Try to import and test UniFi service
  console.log('\nTesting UniFi Service initialization...');
  
  try {
    // Dynamic import to handle ES module
    const { default: unifiAccessService } = await import('../src/services/unifiAccess');
    
    // Wait a moment for initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (unifiAccessService.isInDemoMode()) {
      console.log(`${colors.yellow}⚠ UniFi Service is running in DEMO mode${colors.reset}`);
      console.log('  This means either:');
      console.log('  - UniFi credentials are not configured');
      console.log('  - Cannot connect to UniFi controller');
      console.log('  - Controller URL is unreachable\n');
    } else {
      console.log(`${colors.green}✓ UniFi Service initialized successfully${colors.reset}\n`);
      
      // Test getting door status for Bedford
      console.log('Testing door status retrieval for Bedford...');
      try {
        const status = await unifiAccessService.getDoorStatus('Bedford');
        console.log(`${colors.green}✓ Retrieved status for ${status.length} doors${colors.reset}`);
        
        status.forEach(door => {
          const statusIcon = door.online ? '🟢' : '🔴';
          const lockIcon = door.locked ? '🔒' : '🔓';
          console.log(`  ${statusIcon} ${door.name}: ${lockIcon} ${door.locked ? 'Locked' : 'Unlocked'}`);
        });
      } catch (error: any) {
        console.log(`${colors.red}❌ Failed to get door status: ${error.message}${colors.reset}`);
      }
    }
    
    // Test unlock simulation (won't actually unlock)
    console.log('\nSimulating door unlock (dry run - no actual unlock)...');
    const locations = unifiAccessService.getLocationDoors('Bedford');
    if (locations.length > 0) {
      console.log(`${colors.green}✓ Bedford has ${locations.length} doors configured${colors.reset}`);
      locations.forEach(door => {
        console.log(`  - ${door.name} (${door.type})`);
      });
    }
    
  } catch (error: any) {
    console.log(`${colors.red}❌ Failed to initialize UniFi Service:${colors.reset}`);
    console.log(`  ${error.message}`);
    
    if (error.message.includes('Cannot find module')) {
      console.log('\n  The unifi-access npm package may not be installed.');
      console.log('  Run: npm install unifi-access');
    }
  }

  console.log(`\n${colors.blue}===================================`);
  console.log('Test Complete');
  console.log(`===================================${colors.reset}\n`);
  
  console.log('Next steps:');
  console.log('1. If in DEMO mode, verify your UniFi credentials');
  console.log('2. Ensure UniFi Controller is accessible from this server');
  console.log('3. Add actual door MAC addresses from UniFi Access console');
  console.log('4. Restart the backend server after making changes\n');
}

// Run the test
testUnifiConnection().catch(error => {
  console.error(`${colors.red}Test failed:${colors.reset}`, error);
  process.exit(1);
});