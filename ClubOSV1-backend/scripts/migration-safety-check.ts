import { pool } from '../src/utils/database';
import { logger } from '../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

interface TableInfo {
  name: string;
  rowCount: number;
  columns: string[];
  foreignKeys: Array<{
    column: string;
    referencedTable: string;
    referencedColumn: string;
  }>;
  indexes: string[];
}

class MigrationSafetyCheck {
  private criticalTables = [
    'users', 'customer_profiles', 'challenges', 'cc_transactions',
    'bookings', 'seasons', 'badges', 'user_badges', 'friendships',
    'teams', 'team_memberships', 'achievements', 'user_achievements',
    'rank_assignments', 'challenge_seasons'
  ];

  async run() {
    console.log('🔍 MIGRATION SAFETY CHECK\n');
    console.log('=' .repeat(60));
    
    try {
      // 1. Check database connectivity
      await this.checkDatabaseConnection();
      
      // 2. Analyze current schema
      const schema = await this.analyzeCurrentSchema();
      
      // 3. Check migration tracking
      await this.checkMigrationTracking();
      
      // 4. Verify critical tables
      await this.verifyCriticalTables();
      
      // 5. Check for data integrity
      await this.checkDataIntegrity();
      
      // 6. Generate safety report
      await this.generateSafetyReport(schema);
      
      console.log('\n✅ Safety check complete!');
      
    } catch (error) {
      console.error('\n❌ Safety check failed:', error);
      process.exit(1);
    } finally {
      await pool.end();
    }
  }
  
  private async checkDatabaseConnection() {
    console.log('\n1. Checking database connection...');
    const result = await pool.query('SELECT version()');
    console.log('   ✅ Connected to PostgreSQL:', result.rows[0].version.split(',')[0]);
  }
  
  private async analyzeCurrentSchema(): Promise<Map<string, TableInfo>> {
    console.log('\n2. Analyzing current schema...');
    
    // Get all tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const schema = new Map<string, TableInfo>();
    
    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      
      // Get row count
      const countResult = await pool.query(`SELECT COUNT(*) FROM "${tableName}"`);
      const rowCount = parseInt(countResult.rows[0].count);
      
      // Get columns
      const columnsResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [tableName]);
      
      const columns = columnsResult.rows.map(r => r.column_name);
      
      // Get foreign keys
      const fkResult = await pool.query(`
        SELECT 
          kcu.column_name,
          ccu.table_name AS referenced_table,
          ccu.column_name AS referenced_column
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = $1
      `, [tableName]);
      
      const foreignKeys = fkResult.rows.map(r => ({
        column: r.column_name,
        referencedTable: r.referenced_table,
        referencedColumn: r.referenced_column
      }));
      
      // Get indexes
      const indexResult = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = $1
        AND schemaname = 'public'
      `, [tableName]);
      
      const indexes = indexResult.rows.map(r => r.indexname);
      
      schema.set(tableName, {
        name: tableName,
        rowCount,
        columns,
        foreignKeys,
        indexes
      });
    }
    
    console.log(`   ✅ Found ${schema.size} tables`);
    console.log(`   ✅ Total rows across all tables: ${Array.from(schema.values()).reduce((sum, t) => sum + t.rowCount, 0)}`);
    
    return schema;
  }
  
  private async checkMigrationTracking() {
    console.log('\n3. Checking migration tracking...');
    
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'schema_migrations'
      )
    `);
    
    if (result.rows[0].exists) {
      const migrations = await pool.query('SELECT * FROM schema_migrations ORDER BY version');
      console.log(`   ✅ Migration tracking table exists with ${migrations.rows.length} entries`);
      
      if (migrations.rows.length > 0) {
        console.log('   Recent migrations:');
        migrations.rows.slice(-5).forEach(m => {
          console.log(`     - ${m.version}: ${m.name || 'unnamed'}`);
        });
      }
    } else {
      console.log('   ⚠️  No migration tracking table found');
    }
  }
  
  private async verifyCriticalTables() {
    console.log('\n4. Verifying critical tables...');
    
    for (const table of this.criticalTables) {
      const exists = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )`,
        [table]
      );
      
      if (exists.rows[0].exists) {
        const count = await pool.query(`SELECT COUNT(*) FROM "${table}"`);
        console.log(`   ✅ ${table}: ${count.rows[0].count} rows`);
      } else {
        console.log(`   ❌ ${table}: MISSING`);
      }
    }
  }
  
  private async checkDataIntegrity() {
    console.log('\n5. Checking data integrity...');
    
    // Check for orphaned records
    const orphanChecks = [
      {
        name: 'Challenges without valid users',
        query: `
          SELECT COUNT(*) 
          FROM challenges c 
          WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = c.creator_id)
          OR NOT EXISTS (SELECT 1 FROM users WHERE id = c.acceptor_id)
        `
      },
      {
        name: 'CC transactions without valid users',
        query: `
          SELECT COUNT(*) 
          FROM cc_transactions t 
          WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = t.user_id)
        `
      },
      {
        name: 'Bookings without valid users',
        query: `
          SELECT COUNT(*) 
          FROM bookings b 
          WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = b.user_id)
        `
      }
    ];
    
    for (const check of orphanChecks) {
      try {
        const result = await pool.query(check.query);
        const count = parseInt(result.rows[0].count);
        if (count > 0) {
          console.log(`   ⚠️  ${check.name}: ${count} orphaned records`);
        } else {
          console.log(`   ✅ ${check.name}: No orphans`);
        }
      } catch (error: any) {
        console.log(`   ⏭️  ${check.name}: Skipped (table may not exist)`);
      }
    }
  }
  
  private async generateSafetyReport(schema: Map<string, TableInfo>) {
    console.log('\n6. Generating safety report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      database: {
        totalTables: schema.size,
        totalRows: Array.from(schema.values()).reduce((sum, t) => sum + t.rowCount, 0),
        criticalTablesPresent: this.criticalTables.filter(t => schema.has(t)).length,
        criticalTablesMissing: this.criticalTables.filter(t => !schema.has(t))
      },
      tablesWithData: Array.from(schema.values())
        .filter(t => t.rowCount > 0)
        .map(t => ({ name: t.name, rows: t.rowCount }))
        .sort((a, b) => b.rows - a.rows)
        .slice(0, 20),
      foreignKeyRelationships: Array.from(schema.values())
        .flatMap(t => t.foreignKeys.map(fk => ({
          from: `${t.name}.${fk.column}`,
          to: `${fk.referencedTable}.${fk.referencedColumn}`
        })))
    };
    
    // Write report to file
    const reportPath = path.join(__dirname, '..', '..', 'MIGRATION_SAFETY_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`   ✅ Report saved to: MIGRATION_SAFETY_REPORT.json`);
    console.log(`   ✅ Tables with data: ${report.tablesWithData.length}`);
    console.log(`   ✅ Foreign key relationships: ${report.foreignKeyRelationships.length}`);
  }
}

// Run the safety check
const checker = new MigrationSafetyCheck();
checker.run();