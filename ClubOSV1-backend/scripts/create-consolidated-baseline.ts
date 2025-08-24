import { pool } from '../src/utils/database';
import * as fs from 'fs';
import * as path from 'path';

class ConsolidatedBaselineGenerator {
  private outputPath: string;
  private sql: string[] = [];
  
  constructor() {
    this.outputPath = path.join(__dirname, '..', 'src', 'database', 'migrations', '200_consolidated_production_baseline.sql');
  }
  
  async generate() {
    console.log('🔨 GENERATING CONSOLIDATED BASELINE FROM PRODUCTION\n');
    console.log('=' .repeat(60));
    
    try {
      // Add header
      this.addHeader();
      
      // 1. Extensions
      await this.addExtensions();
      
      // 2. Migration tracking table
      await this.addMigrationTracking();
      
      // 3. All tables in dependency order
      await this.addTables();
      
      // 4. Foreign key constraints
      await this.addForeignKeys();
      
      // 5. Indexes
      await this.addIndexes();
      
      // 6. Initial data for system tables
      await this.addInitialData();
      
      // Write to file
      this.writeToFile();
      
      console.log('\n✅ Consolidated baseline generated successfully!');
      console.log(`📄 File: ${this.outputPath}`);
      
    } catch (error) {
      console.error('\n❌ Failed to generate baseline:', error);
      process.exit(1);
    } finally {
      await pool.end();
    }
  }
  
  private addHeader() {
    this.sql.push('-- =====================================================');
    this.sql.push('-- CONSOLIDATED PRODUCTION BASELINE');
    this.sql.push(`-- Generated: ${new Date().toISOString()}`);
    this.sql.push('-- Purpose: Captures actual production database state');
    this.sql.push('-- =====================================================');
    this.sql.push('');
    this.sql.push('-- This migration represents the current production state');
    this.sql.push('-- It should only be run on a fresh database');
    this.sql.push('');
  }
  
  private async addExtensions() {
    console.log('\n1. Adding extensions...');
    
    const extensions = await pool.query(`
      SELECT extname 
      FROM pg_extension 
      WHERE extname NOT IN ('plpgsql')
      ORDER BY extname
    `);
    
    this.sql.push('-- =====================================================');
    this.sql.push('-- EXTENSIONS');
    this.sql.push('-- =====================================================');
    
    for (const ext of extensions.rows) {
      this.sql.push(`CREATE EXTENSION IF NOT EXISTS "${ext.extname}";`);
    }
    
    this.sql.push('');
    console.log(`   ✅ Added ${extensions.rows.length} extensions`);
  }
  
  private async addMigrationTracking() {
    console.log('\n2. Adding migration tracking...');
    
    this.sql.push('-- =====================================================');
    this.sql.push('-- MIGRATION TRACKING');
    this.sql.push('-- =====================================================');
    
    // Check if table exists
    const exists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'schema_migrations'
      )
    `);
    
    if (exists.rows[0].exists) {
      // Get table structure
      const columns = await pool.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = 'schema_migrations'
        ORDER BY ordinal_position
      `);
      
      let createTable = 'CREATE TABLE IF NOT EXISTS schema_migrations (\n';
      
      const columnDefs = columns.rows.map(col => {
        let def = `  ${col.column_name} ${col.data_type}`;
        if (col.character_maximum_length) {
          def += `(${col.character_maximum_length})`;
        }
        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }
        if (col.column_default) {
          def += ` DEFAULT ${col.column_default}`;
        }
        return def;
      });
      
      createTable += columnDefs.join(',\n');
      createTable += ',\n  PRIMARY KEY (version)\n);';
      
      this.sql.push(createTable);
    } else {
      // Create default schema_migrations table
      this.sql.push(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64),
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  rollback_sql TEXT
);`);
    }
    
    this.sql.push('');
    this.sql.push('-- Mark this baseline as applied');
    this.sql.push(`INSERT INTO schema_migrations (version, name, checksum) 
VALUES ('200', 'consolidated_production_baseline', MD5('consolidated_production_baseline'))
ON CONFLICT (version) DO NOTHING;`);
    
    this.sql.push('');
    console.log('   ✅ Added migration tracking table');
  }
  
  private async addTables() {
    console.log('\n3. Adding tables in dependency order...');
    
    // Get all tables with their dependencies
    const tables = await this.getTablesInDependencyOrder();
    
    this.sql.push('-- =====================================================');
    this.sql.push('-- TABLES');
    this.sql.push('-- =====================================================');
    this.sql.push('');
    
    for (const tableName of tables) {
      await this.addTable(tableName);
    }
    
    console.log(`   ✅ Added ${tables.length} tables`);
  }
  
  private async getTablesInDependencyOrder(): Promise<string[]> {
    // Simplified approach: Get all tables, then sort by dependencies
    const allTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    // Get foreign key dependencies for each table
    const dependencies = await pool.query(`
      SELECT 
        tc.table_name as dependent_table,
        ccu.table_name as referenced_table
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    `);
    
    // Build dependency map
    const depMap = new Map<string, Set<string>>();
    for (const row of dependencies.rows) {
      if (!depMap.has(row.dependent_table)) {
        depMap.set(row.dependent_table, new Set());
      }
      depMap.get(row.dependent_table)!.add(row.referenced_table);
    }
    
    // Topological sort
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (table: string) => {
      if (visited.has(table)) return;
      if (visiting.has(table)) {
        // Circular dependency - just add it
        return;
      }
      
      visiting.add(table);
      
      // Visit dependencies first
      const deps = depMap.get(table);
      if (deps) {
        for (const dep of deps) {
          if (!visited.has(dep)) {
            visit(dep);
          }
        }
      }
      
      visiting.delete(table);
      visited.add(table);
      sorted.push(table);
    };
    
    // Visit all tables
    for (const row of allTables.rows) {
      visit(row.table_name);
    }
    
    return sorted;
  }
  
  private async addTable(tableName: string) {
    // Get columns
    const columns = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable,
        column_default,
        udt_name
      FROM information_schema.columns
      WHERE table_name = $1
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableName]);
    
    // Get primary key
    const primaryKey = await pool.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = $1
      AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position
    `, [tableName]);
    
    // Get unique constraints
    const uniqueConstraints = await pool.query(`
      SELECT 
        tc.constraint_name,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = $1
      AND tc.constraint_type = 'UNIQUE'
      GROUP BY tc.constraint_name
    `, [tableName]);
    
    // Get check constraints
    const checkConstraints = await pool.query(`
      SELECT 
        con.conname as constraint_name,
        pg_get_constraintdef(con.oid) as definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = $1
      AND con.contype = 'c'
    `, [tableName]);
    
    // Build CREATE TABLE statement
    this.sql.push(`-- Table: ${tableName}`);
    let createTable = `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
    
    // Add columns
    const columnDefs = columns.rows.map(col => {
      let def = `  ${col.column_name}`;
      
      // Handle data type
      if (col.data_type === 'USER-DEFINED') {
        def += ` ${col.udt_name}`;
      } else if (col.data_type === 'character varying') {
        def += ` VARCHAR${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`;
      } else if (col.data_type === 'numeric' && col.numeric_precision) {
        def += ` NUMERIC(${col.numeric_precision}${col.numeric_scale ? `, ${col.numeric_scale}` : ''})`;
      } else if (col.data_type === 'ARRAY') {
        def += ` ${col.udt_name.replace('_', '')}[]`;
      } else {
        def += ` ${col.data_type.toUpperCase()}`;
      }
      
      // Add NOT NULL
      if (col.is_nullable === 'NO') {
        def += ' NOT NULL';
      }
      
      // Add DEFAULT
      if (col.column_default) {
        def += ` DEFAULT ${col.column_default}`;
      }
      
      return def;
    });
    
    createTable += columnDefs.join(',\n');
    
    // Add primary key
    if (primaryKey.rows.length > 0) {
      const pkColumns = primaryKey.rows.map(pk => pk.column_name).join(', ');
      createTable += `,\n  PRIMARY KEY (${pkColumns})`;
    }
    
    // Add unique constraints
    for (const uc of uniqueConstraints.rows) {
      createTable += `,\n  CONSTRAINT ${uc.constraint_name} UNIQUE (${uc.columns})`;
    }
    
    // Add check constraints
    for (const cc of checkConstraints.rows) {
      createTable += `,\n  CONSTRAINT ${cc.constraint_name} ${cc.definition}`;
    }
    
    createTable += '\n);';
    
    this.sql.push(createTable);
    this.sql.push('');
  }
  
  private async addForeignKeys() {
    console.log('\n4. Adding foreign key constraints...');
    
    const foreignKeys = await pool.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name, tc.constraint_name
    `);
    
    if (foreignKeys.rows.length > 0) {
      this.sql.push('-- =====================================================');
      this.sql.push('-- FOREIGN KEY CONSTRAINTS');
      this.sql.push('-- =====================================================');
      
      for (const fk of foreignKeys.rows) {
        let constraint = `ALTER TABLE ${fk.table_name} ADD CONSTRAINT ${fk.constraint_name} `;
        constraint += `FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.referenced_table} (${fk.referenced_column})`;
        
        if (fk.delete_rule !== 'NO ACTION') {
          constraint += ` ON DELETE ${fk.delete_rule}`;
        }
        if (fk.update_rule !== 'NO ACTION') {
          constraint += ` ON UPDATE ${fk.update_rule}`;
        }
        
        this.sql.push(constraint + ';');
      }
      
      this.sql.push('');
    }
    
    console.log(`   ✅ Added ${foreignKeys.rows.length} foreign key constraints`);
  }
  
  private async addIndexes() {
    console.log('\n5. Adding indexes...');
    
    const indexes = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
      AND indexname NOT LIKE '%_key'
      ORDER BY tablename, indexname
    `);
    
    if (indexes.rows.length > 0) {
      this.sql.push('-- =====================================================');
      this.sql.push('-- INDEXES');
      this.sql.push('-- =====================================================');
      
      let currentTable = '';
      for (const idx of indexes.rows) {
        if (idx.tablename !== currentTable) {
          this.sql.push(`\n-- Indexes for ${idx.tablename}`);
          currentTable = idx.tablename;
        }
        this.sql.push(idx.indexdef.replace('CREATE INDEX', 'CREATE INDEX IF NOT EXISTS') + ';');
      }
      
      this.sql.push('');
    }
    
    console.log(`   ✅ Added ${indexes.rows.length} indexes`);
  }
  
  private async addInitialData() {
    console.log('\n6. Adding initial data...');
    
    // Only add essential system data, not user data
    this.sql.push('-- =====================================================');
    this.sql.push('-- INITIAL DATA');
    this.sql.push('-- =====================================================');
    
    // Check if badges table has 'key' column
    const badgesColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'badges'
    `);
    
    const hasKeyColumn = badgesColumns.rows.some(r => r.column_name === 'key');
    const orderByColumn = hasKeyColumn ? 'key' : 'id';
    
    // Add default badges if they exist
    const badges = await pool.query(`SELECT * FROM badges ORDER BY ${orderByColumn}`);
    if (badges.rows.length > 0) {
      this.sql.push('\n-- Default badges');
      for (const badge of badges.rows) {
        const columns = Object.keys(badge).filter(k => badge[k] !== null);
        const values = columns.map(col => {
          const val = badge[col];
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
          if (typeof val === 'boolean') return val.toString();
          return val;
        });
        
        const conflictColumn = hasKeyColumn ? 'key' : 'id';
        this.sql.push(
          `INSERT INTO badges (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT (${conflictColumn}) DO NOTHING;`
        );
      }
    }
    
    // Check if achievements table has 'key' column
    const achievementsColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'achievements'
    `);
    
    const hasAchKeyColumn = achievementsColumns.rows.some(r => r.column_name === 'key');
    const achOrderByColumn = hasAchKeyColumn ? 'key' : 'id';
    
    // Add default achievements if they exist
    const achievements = await pool.query(`SELECT * FROM achievements ORDER BY ${achOrderByColumn}`);
    if (achievements.rows.length > 0) {
      this.sql.push('\n-- Default achievements');
      for (const achievement of achievements.rows) {
        const columns = Object.keys(achievement).filter(k => achievement[k] !== null);
        const values = columns.map(col => {
          const val = achievement[col];
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
          if (typeof val === 'boolean') return val.toString();
          return val;
        });
        
        const conflictColumn = hasAchKeyColumn ? 'key' : 'id';
        this.sql.push(
          `INSERT INTO achievements (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT (${conflictColumn}) DO NOTHING;`
        );
      }
    }
    
    this.sql.push('');
    console.log('   ✅ Added initial system data');
  }
  
  private writeToFile() {
    console.log('\n7. Writing to file...');
    
    // Ensure directory exists
    const dir = path.dirname(this.outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(this.outputPath, this.sql.join('\n'));
    
    // Get file stats
    const stats = fs.statSync(this.outputPath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    
    console.log(`   ✅ Written ${this.sql.length} lines (${fileSizeKB} KB)`);
  }
}

// Run the generator
const generator = new ConsolidatedBaselineGenerator();
generator.generate();