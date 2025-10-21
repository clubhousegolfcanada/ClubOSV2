import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Enhanced Migration Runner with rollback support
 * Features:
 * - Version tracking
 * - Checksum validation
 * - Rollback support
 * - Transaction safety
 * - Execution timing
 */

interface Migration {
  version: string;
  name: string;
  upSql: string;
  downSql?: string;
  checksum: string;
}

interface MigrationRecord {
  version: string;
  name: string;
  executed_at: Date;
  checksum: string;
  execution_time_ms: number;
  success: boolean;
  error_message?: string;
}

export class MigrationRunner {
  private pool: Pool;
  private migrationsPath: string;
  private isDryRun: boolean;

  constructor(pool: Pool, migrationsPath: string, isDryRun = false) {
    this.pool = pool;
    this.migrationsPath = migrationsPath;
    this.isDryRun = isDryRun;
  }

  /**
   * Initialize migration tracking table
   */
  async initialize(): Promise<void> {
    const initSql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64),
        execution_time_ms INTEGER,
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        rollback_sql TEXT
      );
    `;

    await this.pool.query(initSql);
    logger.debug('✅ Migration tracking table initialized');
  }

  /**
   * Load all migration files
   */
  async loadMigrations(): Promise<Migration[]> {
    const files = fs.readdirSync(this.migrationsPath)
      .filter(f => f.endsWith('.sql') && !f.includes('.skip'))
      .sort();

    const migrations: Migration[] = [];

    for (const file of files) {
      const filePath = path.join(this.migrationsPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Extract version from filename (e.g., "001_baseline.sql" -> "001")
      const version = file.split('_')[0];
      const name = file.replace('.sql', '');
      
      // Calculate checksum
      const checksum = crypto.createHash('md5').update(content).digest('hex');
      
      // Parse UP and DOWN sections if present
      const upMatch = content.match(/-- UP\n([\s\S]*?)(?:-- DOWN|$)/);
      const downMatch = content.match(/-- DOWN\n([\s\S]*?)$/);
      
      migrations.push({
        version,
        name,
        upSql: upMatch ? upMatch[1] : content,
        downSql: downMatch ? downMatch[1] : undefined,
        checksum
      });
    }

    return migrations;
  }

  /**
   * Get list of already executed migrations
   */
  async getExecutedMigrations(): Promise<Set<string>> {
    const result = await this.pool.query(
      'SELECT version FROM schema_migrations WHERE success = true ORDER BY version'
    );
    return new Set(result.rows.map(r => r.version));
  }

  /**
   * Execute a single migration
   */
  async executeMigration(migration: Migration): Promise<void> {
    const startTime = Date.now();
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      if (this.isDryRun) {
        logger.debug(`🔍 [DRY RUN] Would execute migration ${migration.name}`);
        logger.debug(`SQL Preview (first 500 chars):`);
        logger.debug(migration.upSql.substring(0, 500));
        await client.query('ROLLBACK');
        return;
      }

      // Execute the migration
      logger.debug(`⚙️  Executing migration ${migration.name}...`);
      await client.query(migration.upSql);

      // Record successful migration
      const executionTime = Date.now() - startTime;
      await client.query(
        `INSERT INTO schema_migrations (version, name, checksum, execution_time_ms, success, rollback_sql)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [migration.version, migration.name, migration.checksum, executionTime, true, migration.downSql]
      );

      await client.query('COMMIT');
      logger.debug(`✅ Migration ${migration.name} completed in ${executionTime}ms`);

    } catch (error) {
      await client.query('ROLLBACK');
      
      // Record failed migration
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.pool.query(
        `INSERT INTO schema_migrations (version, name, checksum, execution_time_ms, success, error_message)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (version) DO UPDATE SET
           error_message = $6,
           success = false`,
        [migration.version, migration.name, migration.checksum, Date.now() - startTime, false, errorMessage]
      );

      logger.error(`❌ Migration ${migration.name} failed: ${errorMessage}`);
      throw error;

    } finally {
      client.release();
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    await this.initialize();

    const migrations = await this.loadMigrations();
    const executed = await this.getExecutedMigrations();
    
    const pending = migrations.filter(m => !executed.has(m.version));

    if (pending.length === 0) {
      logger.debug('✅ Database is up to date');
      return;
    }

    logger.debug(`📦 Found ${pending.length} pending migrations`);

    for (const migration of pending) {
      await this.executeMigration(migration);
    }

    logger.debug(`✅ All migrations completed successfully`);
  }

  /**
   * Rollback last N migrations
   */
  async rollback(count = 1): Promise<void> {
    const result = await this.pool.query(
      `SELECT version, name, rollback_sql 
       FROM schema_migrations 
       WHERE success = true AND rollback_sql IS NOT NULL
       ORDER BY version DESC 
       LIMIT $1`,
      [count]
    );

    if (result.rows.length === 0) {
      logger.debug('⚠️  No migrations to rollback');
      return;
    }

    for (const row of result.rows) {
      const client = await this.pool.connect();
      
      try {
        await client.query('BEGIN');

        if (this.isDryRun) {
          logger.debug(`🔍 [DRY RUN] Would rollback migration ${row.name}`);
          await client.query('ROLLBACK');
          continue;
        }

        logger.debug(`⏪ Rolling back migration ${row.name}...`);
        await client.query(row.rollback_sql);
        
        // Remove migration record
        await client.query('DELETE FROM schema_migrations WHERE version = $1', [row.version]);
        
        await client.query('COMMIT');
        logger.debug(`✅ Rolled back migration ${row.name}`);

      } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`❌ Rollback failed for ${row.name}: ${error}`);
        throw error;
      } finally {
        client.release();
      }
    }
  }

  /**
   * Validate migration checksums
   */
  async validate(): Promise<boolean> {
    const migrations = await this.loadMigrations();
    const result = await this.pool.query(
      'SELECT version, checksum FROM schema_migrations WHERE success = true'
    );

    const executed = new Map(result.rows.map(r => [r.version, r.checksum]));
    let valid = true;

    for (const migration of migrations) {
      if (executed.has(migration.version)) {
        const storedChecksum = executed.get(migration.version);
        if (storedChecksum !== migration.checksum) {
          logger.error(`❌ Checksum mismatch for migration ${migration.name}`);
          logger.error(`   Expected: ${migration.checksum}`);
          logger.error(`   Stored:   ${storedChecksum}`);
          valid = false;
        }
      }
    }

    if (valid) {
      logger.debug('✅ All migration checksums are valid');
    }

    return valid;
  }

  /**
   * Show migration status
   */
  async status(): Promise<void> {
    const migrations = await this.loadMigrations();
    const executed = await this.getExecutedMigrations();

    logger.debug('\n📊 Migration Status:');
    logger.debug('─'.repeat(60));

    for (const migration of migrations) {
      const isExecuted = executed.has(migration.version);
      const status = isExecuted ? '✅' : '⏳';
      const label = isExecuted ? 'Applied' : 'Pending';
      
      logger.debug(`${status} ${migration.version} - ${migration.name} [${label}]`);
    }

    logger.debug('─'.repeat(60));
    logger.debug(`Total: ${migrations.length} migrations`);
    logger.debug(`Applied: ${executed.size} | Pending: ${migrations.length - executed.size}`);
  }

  /**
   * Reset database (DANGEROUS - only for development)
   */
  async reset(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot reset database in production!');
    }

    const confirmMessage = 'Type "RESET DATABASE" to confirm: ';
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const confirmation = await new Promise<string>(resolve => {
      readline.question(confirmMessage, resolve);
    });
    readline.close();

    if (confirmation !== 'RESET DATABASE') {
      logger.debug('❌ Reset cancelled');
      return;
    }

    logger.debug('🗑️  Dropping all tables...');
    await this.pool.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
    `);

    logger.debug('✅ Database reset complete');
    
    // Run all migrations
    await this.migrate();
  }
}

// CLI Interface
if (require.main === module) {
  const command = process.argv[2];
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const runner = new MigrationRunner(
    pool,
    path.join(__dirname, '../database/migrations'),
    process.env.DRY_RUN === 'true'
  );

  const run = async () => {
    try {
      switch (command) {
        case 'up':
        case 'migrate':
          await runner.migrate();
          break;
        
        case 'down':
        case 'rollback':
          const count = parseInt(process.argv[3] || '1');
          await runner.rollback(count);
          break;
        
        case 'status':
          await runner.status();
          break;
        
        case 'validate':
          await runner.validate();
          break;
        
        case 'reset':
          await runner.reset();
          break;
        
        default:
          logger.debug(`
Migration Runner Commands:
  migrate   - Run all pending migrations
  rollback  - Rollback last N migrations (default: 1)
  status    - Show migration status
  validate  - Validate migration checksums
  reset     - Reset database (dev only)

Options:
  DRY_RUN=true - Preview changes without executing
          `);
      }
    } catch (error) {
      logger.error('Migration failed:', error);
      process.exit(1);
    } finally {
      await pool.end();
    }
  };

  run();
}