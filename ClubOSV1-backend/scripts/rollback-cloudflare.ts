#!/usr/bin/env npx tsx
/**
 * Rollback Cloudflare tunnel migration
 * Run with: npm run migrate:rollback
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
  cyan: '\x1b[36m',
};

async function findLatestBackup(): Promise<string | null> {
  const backupsDir = path.join(process.cwd(), 'backups');
  
  try {
    const files = await fs.readdir(backupsDir);
    const migrationDirs = files.filter(f => f.startsWith('migration-'));
    
    if (migrationDirs.length === 0) {
      return null;
    }
    
    // Sort by timestamp (newest first)
    migrationDirs.sort((a, b) => {
      const timeA = parseInt(a.replace('migration-', ''));
      const timeB = parseInt(b.replace('migration-', ''));
      return timeB - timeA;
    });
    
    return path.join(backupsDir, migrationDirs[0]);
  } catch (error) {
    return null;
  }
}

async function rollback() {
  console.log(`${colors.cyan}=== Cloudflare Migration Rollback ===${colors.reset}\n`);
  
  // Find latest backup
  const backupDir = await findLatestBackup();
  
  if (!backupDir) {
    console.log(`${colors.red}No backup found to rollback to${colors.reset}`);
    console.log('Run the migration first to create a backup');
    process.exit(1);
  }
  
  console.log(`${colors.blue}Found backup:${colors.reset} ${backupDir}\n`);
  
  try {
    // Restore .env file
    const envBackup = path.join(backupDir, '.env.backup');
    const envTarget = path.join(process.cwd(), '.env');
    
    try {
      await fs.access(envBackup);
      await fs.copyFile(envBackup, envTarget);
      console.log(`${colors.green}✓${colors.reset} Restored .env file`);
    } catch {
      console.log(`${colors.yellow}⚠${colors.reset} No .env backup found`);
    }
    
    // Restore door configuration
    const doorsBackup = path.join(backupDir, 'doors.json.backup');
    const doorsTarget = path.join(process.cwd(), 'config', 'doors.json');
    
    try {
      await fs.access(doorsBackup);
      await fs.copyFile(doorsBackup, doorsTarget);
      console.log(`${colors.green}✓${colors.reset} Restored door configuration`);
    } catch {
      console.log(`${colors.yellow}⚠${colors.reset} No door configuration backup found`);
    }
    
    // Show migration state
    try {
      const stateFile = path.join(backupDir, 'migration-state.json');
      const stateData = await fs.readFile(stateFile, 'utf-8');
      const state = JSON.parse(stateData);
      
      console.log(`\n${colors.blue}Restored to state:${colors.reset}`);
      console.log(`  Timestamp: ${state.timestamp}`);
      console.log(`  Cloudflare: ${state.cloudflareEnabled ? 'Enabled' : 'Disabled'}`);
      console.log(`  Locations: ${state.availableLocations.join(', ')}`);
    } catch {
      // State file might not exist
    }
    
    console.log(`\n${colors.green}✅ Rollback completed successfully${colors.reset}`);
    console.log('\nNext steps:');
    console.log('1. Restart the backend service');
    console.log('2. Verify the system is working');
    console.log('3. Check logs for any issues');
  } catch (error: any) {
    console.log(`${colors.red}Rollback failed: ${error.message}${colors.reset}`);
    console.log('Manual intervention may be required');
    process.exit(1);
  }
}

rollback().catch(console.error);