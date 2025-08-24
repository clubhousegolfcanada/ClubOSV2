import { pool } from '../src/utils/database';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

class DatabaseBackup {
  private backupDir: string;
  private timestamp: string;
  
  constructor() {
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    this.backupDir = path.join(__dirname, '..', '..', 'database-backups', this.timestamp);
  }
  
  async run() {
    console.log('🔒 DATABASE BACKUP UTILITY\n');
    console.log('=' .repeat(60));
    
    try {
      // Create backup directory
      this.createBackupDirectory();
      
      // 1. Export schema structure
      await this.exportSchemaStructure();
      
      // 2. Export data from critical tables
      await this.exportCriticalData();
      
      // 3. Export foreign key relationships
      await this.exportForeignKeys();
      
      // 4. Export indexes
      await this.exportIndexes();
      
      // 5. Create restore script
      await this.createRestoreScript();
      
      // 6. Create verification script
      await this.createVerificationScript();
      
      console.log('\n✅ Backup complete!');
      console.log(`📁 Backup location: ${this.backupDir}`);
      
    } catch (error) {
      console.error('\n❌ Backup failed:', error);
      process.exit(1);
    } finally {
      await pool.end();
    }
  }
  
  private createBackupDirectory() {
    console.log('\n1. Creating backup directory...');
    
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    console.log(`   ✅ Created: ${this.backupDir}`);
  }
  
  private async exportSchemaStructure() {
    console.log('\n2. Exporting schema structure...');
    
    // Get all table definitions
    const tables = await pool.query(`
      SELECT 
        table_name,
        obj_description(pgc.oid) AS comment
      FROM information_schema.tables t
      LEFT JOIN pg_catalog.pg_class pgc ON pgc.relname = t.table_name
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const schemaSQL: string[] = ['-- Database Schema Backup', `-- Generated: ${new Date().toISOString()}`, ''];
    
    for (const table of tables.rows) {
      const tableName = table.table_name;
      
      // Get CREATE TABLE statement
      const columns = await pool.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      const constraints = await pool.query(`
        SELECT 
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS referenced_table,
          ccu.column_name AS referenced_column
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = $1
        AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY', 'CHECK')
      `, [tableName]);
      
      // Build CREATE TABLE statement
      let createTable = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
      
      // Add columns
      const columnDefs = columns.rows.map(col => {
        let def = `  "${col.column_name}" ${col.data_type}`;
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
      
      // Add constraints
      const primaryKey = constraints.rows.filter(c => c.constraint_type === 'PRIMARY KEY');
      if (primaryKey.length > 0) {
        const pkColumns = primaryKey.map(pk => `"${pk.column_name}"`).join(', ');
        createTable += `,\n  PRIMARY KEY (${pkColumns})`;
      }
      
      createTable += '\n);';
      
      schemaSQL.push(`-- Table: ${tableName}`);
      schemaSQL.push(createTable);
      schemaSQL.push('');
    }
    
    // Write schema to file
    fs.writeFileSync(
      path.join(this.backupDir, 'schema.sql'),
      schemaSQL.join('\n')
    );
    
    console.log(`   ✅ Exported ${tables.rows.length} table definitions`);
  }
  
  private async exportCriticalData() {
    console.log('\n3. Exporting critical data...');
    
    const criticalTables = [
      'users', 'customer_profiles', 'challenges', 'cc_transactions',
      'bookings', 'seasons', 'badges', 'user_badges', 'friendships',
      'teams', 'achievements', 'user_achievements', 'rank_assignments'
    ];
    
    for (const tableName of criticalTables) {
      try {
        const result = await pool.query(`SELECT * FROM "${tableName}"`);
        
        if (result.rows.length > 0) {
          // Convert to INSERT statements
          const inserts: string[] = [`-- Data for table: ${tableName}`];
          
          for (const row of result.rows) {
            const columns = Object.keys(row);
            const values = columns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
              return val;
            });
            
            inserts.push(
              `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});`
            );
          }
          
          fs.writeFileSync(
            path.join(this.backupDir, `data_${tableName}.sql`),
            inserts.join('\n')
          );
          
          console.log(`   ✅ ${tableName}: ${result.rows.length} rows`);
        } else {
          console.log(`   ⏭️  ${tableName}: No data`);
        }
      } catch (error: any) {
        console.log(`   ⚠️  ${tableName}: ${error.message}`);
      }
    }
  }
  
  private async exportForeignKeys() {
    console.log('\n4. Exporting foreign key relationships...');
    
    const fkResult = await pool.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name, tc.constraint_name
    `);
    
    const fkSQL: string[] = ['-- Foreign Key Constraints', ''];
    
    for (const fk of fkResult.rows) {
      fkSQL.push(
        `ALTER TABLE "${fk.table_name}" ADD CONSTRAINT "${fk.constraint_name}" ` +
        `FOREIGN KEY ("${fk.column_name}") REFERENCES "${fk.referenced_table}" ("${fk.referenced_column}");`
      );
    }
    
    fs.writeFileSync(
      path.join(this.backupDir, 'foreign_keys.sql'),
      fkSQL.join('\n')
    );
    
    console.log(`   ✅ Exported ${fkResult.rows.length} foreign key constraints`);
  }
  
  private async exportIndexes() {
    console.log('\n5. Exporting indexes...');
    
    const indexResult = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname
    `);
    
    const indexSQL: string[] = ['-- Indexes', ''];
    
    for (const idx of indexResult.rows) {
      indexSQL.push(`${idx.indexdef};`);
    }
    
    fs.writeFileSync(
      path.join(this.backupDir, 'indexes.sql'),
      indexSQL.join('\n')
    );
    
    console.log(`   ✅ Exported ${indexResult.rows.length} indexes`);
  }
  
  private async createRestoreScript() {
    console.log('\n6. Creating restore script...');
    
    const restoreScript = `#!/bin/bash
# Database Restore Script
# Generated: ${new Date().toISOString()}

set -e

echo "🔄 DATABASE RESTORE"
echo "=================="
echo ""
echo "⚠️  WARNING: This will restore the database to the backup state!"
echo "⚠️  All current data will be replaced!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Restore cancelled."
  exit 1
fi

echo ""
echo "1. Loading schema..."
psql $DATABASE_URL -f schema.sql

echo "2. Loading data..."
for file in data_*.sql; do
  if [ -f "$file" ]; then
    echo "   Loading $file..."
    psql $DATABASE_URL -f "$file"
  fi
done

echo "3. Adding foreign keys..."
psql $DATABASE_URL -f foreign_keys.sql

echo "4. Adding indexes..."
psql $DATABASE_URL -f indexes.sql

echo ""
echo "✅ Restore complete!"
`;
    
    fs.writeFileSync(
      path.join(this.backupDir, 'restore.sh'),
      restoreScript
    );
    
    // Make script executable
    fs.chmodSync(path.join(this.backupDir, 'restore.sh'), '755');
    
    console.log(`   ✅ Created restore.sh`);
  }
  
  private async createVerificationScript() {
    console.log('\n7. Creating verification script...');
    
    // Get current counts
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    const counts: { [key: string]: number } = {};
    
    for (const table of tables.rows) {
      const result = await pool.query(`SELECT COUNT(*) FROM "${table.table_name}"`);
      counts[table.table_name] = parseInt(result.rows[0].count);
    }
    
    const verificationData = {
      timestamp: this.timestamp,
      totalTables: tables.rows.length,
      tableCounts: counts,
      checksum: this.generateChecksum(JSON.stringify(counts))
    };
    
    fs.writeFileSync(
      path.join(this.backupDir, 'verification.json'),
      JSON.stringify(verificationData, null, 2)
    );
    
    console.log(`   ✅ Created verification.json`);
  }
  
  private generateChecksum(data: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

// Run the backup
const backup = new DatabaseBackup();
backup.run();