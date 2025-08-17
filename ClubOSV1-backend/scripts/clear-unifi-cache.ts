#!/usr/bin/env npx tsx
/**
 * Clear UniFi Access service cache
 * Run with: npm run unifi:clear-cache
 */

import { unifiAccessService } from '../src/services/unifi/UniFiAccessService';
import dotenv from 'dotenv';

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

async function clearCache() {
  console.log(`${colors.yellow}Clearing UniFi Access cache...${colors.reset}`);
  
  unifiAccessService.clearCache();
  
  console.log(`${colors.green}✓ Cache cleared successfully${colors.reset}`);
  console.log('\nThe next API call will fetch fresh data from UniFi Access.');
}

clearCache().catch(console.error);