/**
 * Enhanced Database Migration System v2
 * 
 * Features:
 * - Version tracking with checksums
 * - Rollback support
 * - Migration locking to prevent concurrent runs
 * - Better error handling and logging
 */

import { db } from './database';
import { logger } from './logger';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface Migration {
  version: string;
  name: string;
  up: string;
  down?: string;
  checksum?: string;
}

export interface MigrationHistory {
  id: number;
  version: string;
  name: string;
  applied_at: Date;
  checksum: string;
  execution_time_ms: number;
  applied_by: string;
}

export class MigrationRunner {
  private migrationsPath: string;
  private lockTimeout = 30000; // 30 seconds

  constructor(migrationsPath: string) {
    this.migrationsPath = migrationsPath;
  }

  /**
   * Initialize migration system - create history table if needed
   */
  async initialize(): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS migration_history (
        id SERIAL PRIMARY KEY,
        version VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64),
        execution_time_ms INTEGER,
        applied_by VARCHAR(255)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS migration_locks (
        id INTEGER PRIMARY KEY DEFAULT 1,
        locked_at TIMESTAMP,
        locked_by VARCHAR(255),
        CONSTRAINT single_lock CHECK (id = 1)
      )
    `);
  }

  /**
   * Acquire migration lock
   */
  private async acquireLock(): Promise<boolean> {
    try {
      // Try to insert lock
      await db.query(`
        INSERT INTO migration_locks (id, locked_at, locked_by)
        VALUES (1, NOW(), $1)
      `, [process.env.HOSTNAME || 'unknown']);
      return true;
    } catch (error) {
      // Check if lock is stale (older than timeout)
      const result = await db.query(`
        SELECT locked_at, locked_by 
        FROM migration_locks 
        WHERE id = 1
      `);

      if (result.rows.length > 0) {
        const lockAge = Date.now() - new Date(result.rows[0].locked_at).getTime();
        if (lockAge > this.lockTimeout) {
          // Stale lock, force release
          await this.releaseLock();
          return this.acquireLock();
        }
        logger.warn(`Migration lock held by ${result.rows[0].locked_by}`);
      }
      return false;
    }
  }

  /**
   * Release migration lock
   */
  private async releaseLock(): Promise<void> {
    await db.query('DELETE FROM migration_locks WHERE id = 1');
  }

  /**
   * Calculate checksum for migration content
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Load migrations from directory
   */
  async loadMigrations(): Promise<Migration[]> {
    const files = await fs.readdir(this.migrationsPath);
    const migrations: Migration[] = [];

    for (const file of files.sort()) {
      if (!file.endsWith('.sql')) continue;

      const filePath = path.join(this.migrationsPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Extract version and name from filename (e.g., "001_initial_schema.sql")
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        logger.warn(`Skipping invalid migration filename: ${file}`);
        continue;
      }

      const [, version, name] = match;
      
      // Split content into UP and DOWN sections
      const sections = content.split(/^-- DOWN$/m);
      const up = sections[0].replace(/^-- UP$/m, '').trim();
      const down = sections[1]?.trim();

      migrations.push({
        version: version.padStart(3, '0'), // Ensure 3-digit version
        name,
        up,
        down,
        checksum: this.calculateChecksum(up)
      });
    }

    return migrations;
  }

  /**
   * Get applied migrations from history
   */
  async getAppliedMigrations(): Promise<MigrationHistory[]> {
    const result = await db.query(`
      SELECT * FROM migration_history
      ORDER BY version ASC
    `);
    return result.rows;
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(migration: Migration): Promise<number> {
    const startTime = Date.now();
    
    try {
      await db.query('BEGIN');
      
      // Execute migration
      await db.query(migration.up);
      
      // Record in history
      await db.query(`
        INSERT INTO migration_history (version, name, checksum, execution_time_ms, applied_by)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        migration.version,
        migration.name,
        migration.checksum,
        Date.now() - startTime,
        process.env.USER || 'system'
      ]);
      
      await db.query('COMMIT');
      
      return Date.now() - startTime;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Rollback a single migration
   */
  private async rollbackMigration(migration: Migration): Promise<void> {
    if (!migration.down) {
      throw new Error(`Migration ${migration.version}_${migration.name} does not support rollback`);
    }

    try {
      await db.query('BEGIN');
      
      // Execute rollback
      await db.query(migration.down);
      
      // Remove from history
      await db.query(`
        DELETE FROM migration_history 
        WHERE version = $1
      `, [migration.version]);
      
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Run pending migrations
   */
  async up(target?: string): Promise<void> {
    await this.initialize();
    
    if (!await this.acquireLock()) {
      throw new Error('Could not acquire migration lock');
    }

    try {
      const migrations = await this.loadMigrations();
      const applied = await this.getAppliedMigrations();
      const appliedVersions = new Set(applied.map(m => m.version));

      let pendingMigrations = migrations.filter(m => !appliedVersions.has(m.version));
      
      // If target specified, only run up to that version
      if (target) {
        pendingMigrations = pendingMigrations.filter(m => m.version <= target);
      }

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations');
        return;
      }

      logger.info(`Found ${pendingMigrations.length} pending migrations`);

      for (const migration of pendingMigrations) {
        logger.info(`Applying migration ${migration.version}_${migration.name}`);
        const time = await this.applyMigration(migration);
        logger.info(`✓ Applied in ${time}ms`);
      }

      logger.info('All migrations completed successfully');
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Rollback migrations
   */
  async down(target?: string): Promise<void> {
    await this.initialize();
    
    if (!await this.acquireLock()) {
      throw new Error('Could not acquire migration lock');
    }

    try {
      const migrations = await this.loadMigrations();
      const applied = await this.getAppliedMigrations();

      // Create map for quick lookup
      const migrationMap = new Map(migrations.map(m => [m.version, m]));

      // Determine which migrations to rollback
      let toRollback = applied.sort((a, b) => b.version.localeCompare(a.version));
      
      if (target) {
        toRollback = toRollback.filter(m => m.version > target);
      } else {
        // If no target, just rollback the last one
        toRollback = toRollback.slice(0, 1);
      }

      if (toRollback.length === 0) {
        logger.info('No migrations to rollback');
        return;
      }

      for (const applied of toRollback) {
        const migration = migrationMap.get(applied.version);
        if (!migration) {
          throw new Error(`Migration ${applied.version} not found in filesystem`);
        }

        logger.info(`Rolling back migration ${migration.version}_${migration.name}`);
        await this.rollbackMigration(migration);
        logger.info('✓ Rolled back');
      }

      logger.info('Rollback completed successfully');
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Get migration status
   */
  async status(): Promise<void> {
    await this.initialize();

    const migrations = await this.loadMigrations();
    const applied = await this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map(m => m.version));

    console.log('\nMigration Status:');
    console.log('=================\n');

    for (const migration of migrations) {
      const isApplied = appliedVersions.has(migration.version);
      const appliedInfo = applied.find(a => a.version === migration.version);
      
      console.log(`[${isApplied ? '✓' : ' '}] ${migration.version}_${migration.name}`);
      
      if (appliedInfo) {
        console.log(`    Applied: ${appliedInfo.applied_at}`);
        console.log(`    By: ${appliedInfo.applied_by}`);
        console.log(`    Time: ${appliedInfo.execution_time_ms}ms`);
      }
    }

    const pending = migrations.filter(m => !appliedVersions.has(m.version));
    console.log(`\nTotal: ${migrations.length} migrations`);
    console.log(`Applied: ${applied.length}`);
    console.log(`Pending: ${pending.length}`);
  }

  /**
   * Verify migration checksums
   */
  async verify(): Promise<boolean> {
    await this.initialize();

    const migrations = await this.loadMigrations();
    const applied = await this.getAppliedMigrations();
    
    let valid = true;

    for (const appliedMigration of applied) {
      const currentMigration = migrations.find(m => m.version === appliedMigration.version);
      
      if (!currentMigration) {
        logger.error(`Applied migration ${appliedMigration.version}_${appliedMigration.name} not found in filesystem`);
        valid = false;
        continue;
      }

      if (currentMigration.checksum !== appliedMigration.checksum) {
        logger.error(`Checksum mismatch for ${appliedMigration.version}_${appliedMigration.name}`);
        logger.error(`  Expected: ${appliedMigration.checksum}`);
        logger.error(`  Actual: ${currentMigration.checksum}`);
        valid = false;
      }
    }

    if (valid) {
      logger.info('All migration checksums valid');
    }

    return valid;
  }
}

// Export singleton instance
export const migrationRunner = new MigrationRunner(
  path.join(__dirname, '..', 'database', 'migrations')
);