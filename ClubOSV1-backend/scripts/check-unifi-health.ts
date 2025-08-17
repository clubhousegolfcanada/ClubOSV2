#!/usr/bin/env npx tsx
/**
 * Check UniFi Access service health
 * Run with: npm run health:unifi
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

async function checkHealth() {
  console.log(`${colors.cyan}=== UniFi Access Health Check ===${colors.reset}\n`);
  
  try {
    const health = await unifiAccessService.getHealthStatus();
    
    console.log(`${colors.blue}Overall Status:${colors.reset} ${health.healthy ? colors.green + 'HEALTHY' : colors.red + 'UNHEALTHY'}${colors.reset}`);
    console.log(`${colors.blue}Cloudflare Mode:${colors.reset} ${health.cloudflareEnabled ? 'Enabled' : 'Disabled'}\n`);
    
    console.log(`${colors.blue}Location Status:${colors.reset}`);
    for (const location of health.locations) {
      const status = location.connected ? colors.green + '✓ Connected' : colors.red + '✗ Disconnected';
      console.log(`  ${location.name}: ${status}${colors.reset}`);
      console.log(`    Available: ${location.available}`);
    }
    
    if (!health.healthy) {
      console.log(`\n${colors.yellow}⚠️  Some locations are not connected${colors.reset}`);
      console.log('Check your Cloudflare tunnel configuration and UniFi Access tokens');
    }
  } catch (error: any) {
    console.log(`${colors.red}Health check failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

checkHealth().catch(console.error);