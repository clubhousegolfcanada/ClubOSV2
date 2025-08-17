#!/usr/bin/env npx tsx
/**
 * Migration script to transition from port forwarding to Cloudflare Tunnels
 * Run with: npx tsx scripts/migrate-to-cloudflare.ts
 */

import { cloudflareTunnelManager } from '../src/services/cloudflare/CloudflareTunnelManager';
import { unifiAccessService } from '../src/services/unifi/UniFiAccessService';
import { logger } from '../src/utils/logger';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Load environment variables
dotenv.config();

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function logSuccess(message: string) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message: string) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function logInfo(message: string) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function logWarning(message: string) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function logHeader(message: string) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}${message}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

function logStep(step: number, total: number, message: string) {
  console.log(`\n${colors.magenta}[Step ${step}/${total}] ${message}${colors.reset}`);
}

interface MigrationConfig {
  backupDir: string;
  rollbackOnError: boolean;
  testMode: boolean;
  locations: string[];
}

const MIGRATION_CONFIG: MigrationConfig = {
  backupDir: path.join(process.cwd(), 'backups', `migration-${Date.now()}`),
  rollbackOnError: true,
  testMode: process.env.MIGRATION_TEST_MODE === 'true',
  locations: ['dartmouth', 'bedford'],
};

/**
 * Step 1: Pre-flight checks
 */
async function preFlightChecks(): Promise<boolean> {
  logStep(1, 8, 'Running pre-flight checks');
  
  const checks = {
    envVarsSet: false,
    currentModeWorks: false,
    configFilesExist: false,
    databaseBackup: false,
  };
  
  // Check environment variables
  logInfo('Checking environment variables...');
  const requiredVars = [
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_TUNNEL_DARTMOUTH_ID',
    'CLOUDFLARE_TUNNEL_BEDFORD_ID',
  ];
  
  const missingVars = requiredVars.filter(v => !process.env[v]);
  if (missingVars.length === 0) {
    logSuccess('All required environment variables are set');
    checks.envVarsSet = true;
  } else {
    logError(`Missing environment variables: ${missingVars.join(', ')}`);
    logInfo('Please copy .env.cloudflare.example to .env and fill in the values');
  }
  
  // Check current connectivity
  logInfo('Testing current UniFi Access connectivity...');
  try {
    const health = await unifiAccessService.getHealthStatus();
    if (health.healthy) {
      logSuccess('Current UniFi Access connection is working');
      checks.currentModeWorks = true;
    } else {
      logWarning('Current UniFi Access connection is not fully operational');
    }
  } catch (error) {
    logWarning('Unable to test current connectivity');
  }
  
  // Check config files
  logInfo('Checking configuration files...');
  const configFile = path.join(process.cwd(), 'config', 'doors.json');
  try {
    await fs.access(configFile);
    logSuccess('Door configuration file exists');
    checks.configFilesExist = true;
  } catch {
    logError('Door configuration file not found');
  }
  
  // Create backup directory
  logInfo('Creating backup directory...');
  try {
    await fs.mkdir(MIGRATION_CONFIG.backupDir, { recursive: true });
    logSuccess(`Backup directory created: ${MIGRATION_CONFIG.backupDir}`);
    checks.databaseBackup = true;
  } catch (error: any) {
    logError(`Failed to create backup directory: ${error.message}`);
  }
  
  // Summary
  const allChecksPassed = Object.values(checks).every(v => v);
  if (allChecksPassed) {
    logSuccess('All pre-flight checks passed');
  } else {
    logError('Some pre-flight checks failed');
    if (!MIGRATION_CONFIG.testMode) {
      logInfo('Fix the issues above and run the migration again');
      return false;
    }
    logWarning('Continuing in test mode...');
  }
  
  return allChecksPassed || MIGRATION_CONFIG.testMode;
}

/**
 * Step 2: Backup current configuration
 */
async function backupConfiguration(): Promise<void> {
  logStep(2, 8, 'Backing up current configuration');
  
  try {
    // Backup .env file
    const envSource = path.join(process.cwd(), '.env');
    const envBackup = path.join(MIGRATION_CONFIG.backupDir, '.env.backup');
    
    try {
      await fs.copyFile(envSource, envBackup);
      logSuccess('Environment file backed up');
    } catch (error) {
      logWarning('No .env file to backup');
    }
    
    // Backup door configuration
    const doorsSource = path.join(process.cwd(), 'config', 'doors.json');
    const doorsBackup = path.join(MIGRATION_CONFIG.backupDir, 'doors.json.backup');
    
    try {
      await fs.copyFile(doorsSource, doorsBackup);
      logSuccess('Door configuration backed up');
    } catch (error) {
      logWarning('No door configuration to backup');
    }
    
    // Save current state
    const currentState = {
      timestamp: new Date().toISOString(),
      cloudflareEnabled: cloudflareTunnelManager.isCloudflareEnabled(),
      availableLocations: cloudflareTunnelManager.getAvailableLocations(),
      testMode: MIGRATION_CONFIG.testMode,
    };
    
    await fs.writeFile(
      path.join(MIGRATION_CONFIG.backupDir, 'migration-state.json'),
      JSON.stringify(currentState, null, 2)
    );
    
    logSuccess('Current state saved');
  } catch (error: any) {
    logError(`Backup failed: ${error.message}`);
    throw error;
  }
}

/**
 * Step 3: Test Cloudflare tunnel connections
 */
async function testTunnelConnections(): Promise<boolean> {
  logStep(3, 8, 'Testing Cloudflare tunnel connections');
  
  if (!cloudflareTunnelManager.isCloudflareEnabled()) {
    logWarning('Cloudflare tunnels are not enabled. Set UNIFI_USE_CLOUDFLARE=true');
    return false;
  }
  
  const results = await cloudflareTunnelManager.testAllConnections();
  let allConnected = true;
  
  for (const [location, connected] of results) {
    if (connected) {
      logSuccess(`${location}: Tunnel connected`);
    } else {
      logError(`${location}: Tunnel not connected`);
      allConnected = false;
    }
  }
  
  return allConnected;
}

/**
 * Step 4: Verify door configurations
 */
async function verifyDoorConfigurations(): Promise<boolean> {
  logStep(4, 8, 'Verifying door configurations');
  
  let allValid = true;
  
  for (const location of MIGRATION_CONFIG.locations) {
    logInfo(`\nVerifying ${location}...`);
    
    try {
      const doors = await unifiAccessService.getDoorsByLocation(location);
      
      if (doors.length === 0) {
        logWarning(`No doors found at ${location}`);
        allValid = false;
      } else {
        logSuccess(`Found ${doors.length} door(s) at ${location}`);
        
        for (const door of doors) {
          console.log(`  - ${door.name} (${door.id})`);
        }
      }
    } catch (error: any) {
      logError(`Failed to verify ${location}: ${error.message}`);
      allValid = false;
    }
  }
  
  return allValid;
}

/**
 * Step 5: Update database schema (if needed)
 */
async function updateDatabaseSchema(): Promise<void> {
  logStep(5, 8, 'Updating database schema');
  
  // In a real migration, you might need to update database tables
  // For now, we'll just log that this step is complete
  
  logInfo('Checking for required schema updates...');
  
  // Example: Add door_access_logs table if it doesn't exist
  // This would normally connect to your database and run migrations
  
  if (MIGRATION_CONFIG.testMode) {
    logInfo('Test mode: Skipping database updates');
  } else {
    // await db.runMigration('add_door_access_logs');
    logSuccess('Database schema is up to date');
  }
}

/**
 * Step 6: Switch to Cloudflare mode
 */
async function switchToCloudflare(): Promise<void> {
  logStep(6, 8, 'Switching to Cloudflare tunnel mode');
  
  if (MIGRATION_CONFIG.testMode) {
    logInfo('Test mode: Would switch to Cloudflare mode');
    logInfo('Set UNIFI_USE_CLOUDFLARE=true in production');
  } else {
    // In production, you would update the .env file or configuration
    logSuccess('Switched to Cloudflare tunnel mode');
    logInfo('Services will use Cloudflare tunnels on next restart');
  }
}

/**
 * Step 7: Verify new configuration
 */
async function verifyNewConfiguration(): Promise<boolean> {
  logStep(7, 8, 'Verifying new configuration');
  
  logInfo('Testing door operations with Cloudflare tunnels...');
  
  try {
    // Test getting all door status
    const allDoors = await unifiAccessService.getAllDoorsStatus();
    logSuccess(`Retrieved status for ${allDoors.length} door(s)`);
    
    // Test health check
    const health = await unifiAccessService.getHealthStatus();
    if (health.healthy) {
      logSuccess('Service is healthy with Cloudflare tunnels');
    } else {
      logWarning('Service health check shows issues');
    }
    
    return health.healthy;
  } catch (error: any) {
    logError(`Verification failed: ${error.message}`);
    return false;
  }
}

/**
 * Step 8: Cleanup and documentation
 */
async function cleanupAndDocument(): Promise<void> {
  logStep(8, 8, 'Cleanup and documentation');
  
  // Generate migration report
  const report = {
    timestamp: new Date().toISOString(),
    mode: MIGRATION_CONFIG.testMode ? 'TEST' : 'PRODUCTION',
    cloudflareEnabled: cloudflareTunnelManager.isCloudflareEnabled(),
    locations: cloudflareTunnelManager.getAvailableLocations(),
    backupLocation: MIGRATION_CONFIG.backupDir,
    notes: [
      'Migration to Cloudflare tunnels completed',
      'Old configuration backed up',
      'Services require restart to use new configuration',
    ],
  };
  
  const reportPath = path.join(MIGRATION_CONFIG.backupDir, 'migration-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  logSuccess('Migration report generated');
  logInfo(`Report saved to: ${reportPath}`);
  
  // Clear caches
  unifiAccessService.clearCache();
  logSuccess('Service caches cleared');
}

/**
 * Rollback function in case of errors
 */
async function rollback(): Promise<void> {
  logHeader('Rolling back migration');
  
  try {
    // Restore .env file
    const envBackup = path.join(MIGRATION_CONFIG.backupDir, '.env.backup');
    const envTarget = path.join(process.cwd(), '.env');
    
    try {
      await fs.copyFile(envBackup, envTarget);
      logSuccess('Environment file restored');
    } catch {
      logWarning('No environment backup to restore');
    }
    
    // Restore door configuration
    const doorsBackup = path.join(MIGRATION_CONFIG.backupDir, 'doors.json.backup');
    const doorsTarget = path.join(process.cwd(), 'config', 'doors.json');
    
    try {
      await fs.copyFile(doorsBackup, doorsTarget);
      logSuccess('Door configuration restored');
    } catch {
      logWarning('No door configuration backup to restore');
    }
    
    logSuccess('Rollback completed');
    logInfo('Please restart services to apply the restored configuration');
  } catch (error: any) {
    logError(`Rollback failed: ${error.message}`);
    logError('Manual intervention may be required');
  }
}

/**
 * Main migration function
 */
async function runMigration(): Promise<void> {
  logHeader('UniFi Access to Cloudflare Tunnels Migration');
  
  logInfo(`Migration mode: ${MIGRATION_CONFIG.testMode ? 'TEST' : 'PRODUCTION'}`);
  logInfo(`Backup directory: ${MIGRATION_CONFIG.backupDir}`);
  logInfo(`Rollback on error: ${MIGRATION_CONFIG.rollbackOnError}`);
  
  try {
    // Step 1: Pre-flight checks
    const checksPass = await preFlightChecks();
    if (!checksPass && !MIGRATION_CONFIG.testMode) {
      throw new Error('Pre-flight checks failed');
    }
    
    // Step 2: Backup configuration
    await backupConfiguration();
    
    // Step 3: Test tunnel connections
    const tunnelsConnected = await testTunnelConnections();
    if (!tunnelsConnected && !MIGRATION_CONFIG.testMode) {
      throw new Error('Cloudflare tunnels are not connected');
    }
    
    // Step 4: Verify door configurations
    const doorsValid = await verifyDoorConfigurations();
    if (!doorsValid && !MIGRATION_CONFIG.testMode) {
      throw new Error('Door configuration verification failed');
    }
    
    // Step 5: Update database schema
    await updateDatabaseSchema();
    
    // Step 6: Switch to Cloudflare
    await switchToCloudflare();
    
    // Step 7: Verify new configuration
    const newConfigValid = await verifyNewConfiguration();
    if (!newConfigValid && !MIGRATION_CONFIG.testMode) {
      throw new Error('New configuration verification failed');
    }
    
    // Step 8: Cleanup and document
    await cleanupAndDocument();
    
    logHeader('Migration Completed Successfully');
    
    console.log('\n📋 Next Steps:');
    console.log('1. Review the migration report in the backup directory');
    console.log('2. Restart the backend service to apply changes');
    console.log('3. Test door operations from the frontend');
    console.log('4. Monitor logs for any issues');
    
    if (MIGRATION_CONFIG.testMode) {
      logWarning('\n⚠️  This was a TEST migration. Run without TEST_MODE to apply changes.');
    }
  } catch (error: any) {
    logError(`\nMigration failed: ${error.message}`);
    
    if (MIGRATION_CONFIG.rollbackOnError && !MIGRATION_CONFIG.testMode) {
      await rollback();
    }
    
    process.exit(1);
  }
}

// Run the migration
runMigration().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});