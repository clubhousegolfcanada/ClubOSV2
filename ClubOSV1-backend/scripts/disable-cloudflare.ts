#!/usr/bin/env npx tsx
/**
 * Disable Cloudflare tunnels and switch back to direct mode
 * Run with: npm run unifi:disable-cloudflare
 */

import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

async function disableCloudflare() {
  console.log(`${colors.yellow}=== Disabling Cloudflare Tunnels ===${colors.reset}\n`);
  
  const envPath = path.join(process.cwd(), '.env');
  
  try {
    // Read current .env
    let envContent = await fs.readFile(envPath, 'utf-8');
    
    // Update UNIFI_USE_CLOUDFLARE to false
    if (envContent.includes('UNIFI_USE_CLOUDFLARE=true')) {
      envContent = envContent.replace('UNIFI_USE_CLOUDFLARE=true', 'UNIFI_USE_CLOUDFLARE=false');
      console.log(`${colors.green}✓${colors.reset} Set UNIFI_USE_CLOUDFLARE=false`);
    } else if (!envContent.includes('UNIFI_USE_CLOUDFLARE')) {
      envContent += '\n# Cloudflare disabled\nUNIFI_USE_CLOUDFLARE=false\n';
      console.log(`${colors.green}✓${colors.reset} Added UNIFI_USE_CLOUDFLARE=false`);
    } else {
      console.log(`${colors.blue}ℹ${colors.reset} Cloudflare already disabled`);
    }
    
    // Write back
    await fs.writeFile(envPath, envContent);
    
    console.log(`\n${colors.green}✅ Cloudflare tunnels disabled${colors.reset}`);
    console.log('\nNext steps:');
    console.log('1. Restart the backend service');
    console.log('2. System will use direct connections (port forwarding/VPN)');
    console.log('3. Ensure port forwarding is configured if needed');
  } catch (error: any) {
    console.log(`${colors.red}Failed to disable Cloudflare: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

disableCloudflare().catch(console.error);