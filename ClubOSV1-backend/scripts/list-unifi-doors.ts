#!/usr/bin/env npx tsx
/**
 * List all configured UniFi doors
 * Run with: npm run list:unifi-doors
 */

import { unifiAccessService } from '../src/services/unifi/UniFiAccessService';
import { cloudflareTunnelManager } from '../src/services/cloudflare/CloudflareTunnelManager';
import dotenv from 'dotenv';

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

async function listDoors() {
  console.log(`${colors.cyan}=== UniFi Door Listing ===${colors.reset}\n`);
  
  const locations = cloudflareTunnelManager.getAvailableLocations();
  console.log(`${colors.blue}Available locations:${colors.reset} ${locations.join(', ')}\n`);
  
  for (const location of locations) {
    console.log(`${colors.cyan}📍 ${location.toUpperCase()}${colors.reset}`);
    
    try {
      const doors = await unifiAccessService.getDoorsByLocation(location);
      
      if (doors.length === 0) {
        console.log(`${colors.yellow}  No doors found${colors.reset}\n`);
      } else {
        for (const door of doors) {
          console.log(`  ${colors.green}✓${colors.reset} ${door.name}`);
          console.log(`    ID: ${door.id}`);
          console.log(`    MAC: ${door.mac || 'N/A'}`);
          console.log(`    Status: ${door.door_lock_relay_status || 'unknown'}`);
          console.log(`    Position: ${door.door_position_status || 'unknown'}\n`);
        }
      }
    } catch (error: any) {
      console.log(`  ${colors.red}✗ Error: ${error.message}${colors.reset}\n`);
    }
  }
}

listDoors().catch(console.error);