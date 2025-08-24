import { pool } from '../src/utils/database';
import * as fs from 'fs';
import * as path from 'path';

async function verifyConsolidation() {
  console.log('🔍 MIGRATION CONSOLIDATION VERIFICATION\n');
  console.log('=' .repeat(60));
  
  const results: { check: string; status: string; details: string }[] = [];
  
  try {
    // 1. Check migration files
    console.log('\n1. Migration Files Check...');
    const migrationsDir = path.join(__dirname, '..', 'src', 'database', 'migrations');
    const sqlFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql') && !f.includes('skip') && !f.includes('broken'));
    const archivedFiles = fs.existsSync(path.join(migrationsDir, 'archived_2025_08_24')) ? 
      fs.readdirSync(path.join(migrationsDir, 'archived_2025_08_24')).filter(f => f.endsWith('.sql')) : [];
    
    results.push({
      check: 'Migration Files',
      status: sqlFiles.length === 1 ? '✅' : '❌',
      details: `Active: ${sqlFiles.length}, Archived: ${archivedFiles.length}`
    });
    
    // 2. Check consolidated baseline exists
    console.log('2. Consolidated Baseline Check...');
    const baselineExists = fs.existsSync(path.join(migrationsDir, '200_consolidated_production_baseline.sql'));
    const baselineSize = baselineExists ? 
      fs.statSync(path.join(migrationsDir, '200_consolidated_production_baseline.sql')).size : 0;
    
    results.push({
      check: 'Consolidated Baseline',
      status: baselineExists ? '✅' : '❌',
      details: baselineExists ? `Size: ${(baselineSize / 1024).toFixed(2)} KB` : 'Not found'
    });
    
    // 3. Check database tables
    console.log('3. Database Tables Check...');
    const tablesResult = await pool.query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const tableCount = parseInt(tablesResult.rows[0].count);
    
    results.push({
      check: 'Database Tables',
      status: tableCount >= 100 ? '✅' : '⚠️',
      details: `Count: ${tableCount}`
    });
    
    // 4. Check critical tables with data
    console.log('4. Critical Tables Check...');
    const criticalTables = ['users', 'customer_profiles', 'seasons', 'badges', 'achievements'];
    let allCriticalPresent = true;
    const criticalDetails: string[] = [];
    
    for (const table of criticalTables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        criticalDetails.push(`${table}: ${count}`);
      } catch (error) {
        allCriticalPresent = false;
        criticalDetails.push(`${table}: ❌`);
      }
    }
    
    results.push({
      check: 'Critical Tables',
      status: allCriticalPresent ? '✅' : '❌',
      details: criticalDetails.join(', ')
    });
    
    // 5. Check migration tracking
    console.log('5. Migration Tracking Check...');
    const migrationsResult = await pool.query(
      'SELECT version, name FROM schema_migrations ORDER BY version'
    );
    const has200 = migrationsResult.rows.some(m => m.version === '200');
    
    results.push({
      check: 'Migration Tracking',
      status: has200 ? '✅' : '❌',
      details: `Tracked: ${migrationsResult.rows.length}, Has v200: ${has200}`
    });
    
    // 6. Check foreign key constraints
    console.log('6. Foreign Key Constraints Check...');
    const fkResult = await pool.query(`
      SELECT COUNT(*) 
      FROM information_schema.table_constraints 
      WHERE constraint_type = 'FOREIGN KEY'
    `);
    const fkCount = parseInt(fkResult.rows[0].count);
    
    results.push({
      check: 'Foreign Keys',
      status: fkCount >= 90 ? '✅' : '⚠️',
      details: `Count: ${fkCount}`
    });
    
    // 7. Check indexes
    console.log('7. Indexes Check...');
    const indexResult = await pool.query(`
      SELECT COUNT(*) 
      FROM pg_indexes 
      WHERE schemaname = 'public'
    `);
    const indexCount = parseInt(indexResult.rows[0].count);
    
    results.push({
      check: 'Indexes',
      status: indexCount >= 200 ? '✅' : '⚠️',
      details: `Count: ${indexCount}`
    });
    
    // 8. Check backup exists
    console.log('8. Backup Check...');
    const backupDir = path.join(__dirname, '..', '..', 'database-backups', '2025-08-24T12-23-52');
    const backupExists = fs.existsSync(backupDir);
    const backupFiles = backupExists ? fs.readdirSync(backupDir).length : 0;
    
    results.push({
      check: 'Database Backup',
      status: backupExists ? '✅' : '⚠️',
      details: backupExists ? `Files: ${backupFiles}` : 'Not found'
    });
    
    // Print results
    console.log('\n' + '=' .repeat(60));
    console.log('VERIFICATION RESULTS:\n');
    
    results.forEach(r => {
      console.log(`${r.status} ${r.check}`);
      console.log(`   ${r.details}`);
    });
    
    // Overall status
    const failedChecks = results.filter(r => r.status === '❌').length;
    const warningChecks = results.filter(r => r.status === '⚠️').length;
    
    console.log('\n' + '=' .repeat(60));
    if (failedChecks === 0 && warningChecks === 0) {
      console.log('✅ ALL CHECKS PASSED - Consolidation successful!');
    } else if (failedChecks === 0) {
      console.log(`⚠️  PASSED WITH WARNINGS - ${warningChecks} warnings`);
    } else {
      console.log(`❌ FAILED - ${failedChecks} critical issues, ${warningChecks} warnings`);
    }
    
  } catch (error) {
    console.error('❌ Verification error:', error);
  } finally {
    await pool.end();
  }
}

verifyConsolidation();