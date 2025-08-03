#!/usr/bin/env npx tsx
/**
 * Database Migration CLI
 * 
 * Commands:
 *   migrate up [target]      - Run pending migrations up to target version
 *   migrate down [target]    - Rollback migrations down to target version
 *   migrate status          - Show migration status
 *   migrate verify          - Verify migration checksums
 *   migrate create <name>   - Create a new migration file
 */

import { migrationRunner } from '../utils/database-migrations-v2';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

const command = process.argv[2];
const arg = process.argv[3];

async function createMigration(name: string): Promise<void> {
  if (!name || !name.match(/^[a-z0-9_]+$/)) {
    throw new Error('Migration name must contain only lowercase letters, numbers, and underscores');
  }

  // Get next version number
  const migrationsPath = path.join(__dirname, '..', 'database', 'migrations');
  const files = await fs.readdir(migrationsPath);
  const versions = files
    .filter(f => f.match(/^\d{3}_/))
    .map(f => parseInt(f.substring(0, 3)))
    .filter(v => !isNaN(v));
  
  const nextVersion = Math.max(0, ...versions) + 1;
  const versionStr = nextVersion.toString().padStart(3, '0');
  
  const filename = `${versionStr}_${name}.sql`;
  const filepath = path.join(migrationsPath, filename);
  
  const template = `-- UP
-- Migration: ${name}
-- Description: Add description here
-- Author: ${process.env.USER || 'unknown'}
-- Date: ${new Date().toISOString()}



-- DOWN
-- Rollback for ${name}


`;

  await fs.writeFile(filepath, template);
  console.log(`Created migration: ${filename}`);
}

async function main() {
  try {
    if (!command) {
      console.log('Usage: migrate <command> [options]');
      console.log('Commands:');
      console.log('  up [target]     - Run pending migrations');
      console.log('  down [target]   - Rollback migrations');
      console.log('  status          - Show migration status');
      console.log('  verify          - Verify checksums');
      console.log('  create <name>   - Create new migration');
      process.exit(0);
    }

    // Initialize database for all commands except create
    if (command !== 'create') {
      await db.initialize();
    }

    switch (command) {
      case 'up':
        await migrationRunner.up(arg);
        break;
        
      case 'down':
        await migrationRunner.down(arg);
        break;
        
      case 'status':
        await migrationRunner.status();
        break;
        
      case 'verify':
        const valid = await migrationRunner.verify();
        process.exit(valid ? 0 : 1);
        break;
        
      case 'create':
        if (!arg) {
          throw new Error('Migration name required');
        }
        await createMigration(arg);
        break;
        
      default:
        throw new Error(`Unknown command: ${command}`);
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}