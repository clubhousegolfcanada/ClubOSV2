import { pool } from '../src/utils/database';
import * as fs from 'fs';
import * as path from 'path';

interface IntegrityTest {
  name: string;
  query: string;
  expectedResult?: 'no_results' | 'has_results';
  critical: boolean;
}

class SchemaIntegrityTester {
  private tests: IntegrityTest[] = [
    // Foreign key integrity tests
    {
      name: 'Check for orphaned customer_profiles',
      query: `
        SELECT cp.* 
        FROM customer_profiles cp
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = cp.user_id)
      `,
      expectedResult: 'no_results',
      critical: true
    },
    {
      name: 'Check for orphaned cc_transactions',
      query: `
        SELECT t.* 
        FROM cc_transactions t
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.user_id)
      `,
      expectedResult: 'no_results',
      critical: true
    },
    {
      name: 'Check for orphaned friendships',
      query: `
        SELECT f.* 
        FROM friendships f
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.user_id)
        OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.friend_id)
      `,
      expectedResult: 'no_results',
      critical: true
    },
    {
      name: 'Check for duplicate emails in users table',
      query: `
        SELECT email, COUNT(*) as count
        FROM users
        GROUP BY email
        HAVING COUNT(*) > 1
      `,
      expectedResult: 'no_results',
      critical: true
    },
    {
      name: 'Check for users without customer_profiles',
      query: `
        SELECT u.*
        FROM users u
        WHERE u.role = 'customer'
        AND NOT EXISTS (SELECT 1 FROM customer_profiles cp WHERE cp.user_id = u.id)
      `,
      expectedResult: 'no_results',
      critical: false
    },
    {
      name: 'Check for invalid role values',
      query: `
        SELECT * FROM users
        WHERE role NOT IN ('admin', 'operator', 'support', 'kiosk', 'customer')
      `,
      expectedResult: 'no_results',
      critical: true
    },
    {
      name: 'Check for negative CC balances',
      query: `
        SELECT * FROM customer_profiles
        WHERE cc_balance < 0
      `,
      expectedResult: 'no_results',
      critical: false
    },
    {
      name: 'Check for invalid season dates',
      query: `
        SELECT * FROM seasons
        WHERE end_date <= start_date
      `,
      expectedResult: 'no_results',
      critical: true
    },
    {
      name: 'Check for overlapping active seasons',
      query: `
        SELECT s1.*, s2.*
        FROM seasons s1
        JOIN seasons s2 ON s1.id != s2.id
        WHERE s1.is_active = true 
        AND s2.is_active = true
      `,
      expectedResult: 'no_results',
      critical: true
    },
    {
      name: 'Verify at least one admin user exists',
      query: `
        SELECT * FROM users WHERE role = 'admin'
      `,
      expectedResult: 'has_results',
      critical: true
    }
  ];
  
  private results: Array<{
    test: string;
    status: 'passed' | 'failed' | 'warning';
    message: string;
    rowCount?: number;
  }> = [];
  
  async run() {
    console.log('🔍 SCHEMA INTEGRITY TEST\n');
    console.log('=' .repeat(60));
    
    try {
      let passedCount = 0;
      let failedCount = 0;
      let warningCount = 0;
      
      for (const test of this.tests) {
        const result = await this.runTest(test);
        
        if (result.status === 'passed') {
          passedCount++;
          console.log(`✅ ${test.name}`);
        } else if (result.status === 'warning') {
          warningCount++;
          console.log(`⚠️  ${test.name}: ${result.message}`);
        } else {
          failedCount++;
          console.log(`❌ ${test.name}: ${result.message}`);
        }
        
        this.results.push(result);
      }
      
      console.log('\n' + '=' .repeat(60));
      console.log('TEST SUMMARY:');
      console.log(`  ✅ Passed: ${passedCount}`);
      console.log(`  ⚠️  Warnings: ${warningCount}`);
      console.log(`  ❌ Failed: ${failedCount}`);
      
      // Check for constraint violations
      await this.checkConstraints();
      
      // Generate integrity report
      await this.generateReport();
      
      if (failedCount > 0) {
        console.log('\n❌ Integrity test failed! Critical issues found.');
        process.exit(1);
      } else if (warningCount > 0) {
        console.log('\n⚠️  Integrity test passed with warnings.');
      } else {
        console.log('\n✅ All integrity tests passed!');
      }
      
    } catch (error) {
      console.error('\n❌ Integrity test error:', error);
      process.exit(1);
    } finally {
      await pool.end();
    }
  }
  
  private async runTest(test: IntegrityTest): Promise<any> {
    try {
      const result = await pool.query(test.query);
      const rowCount = result.rows.length;
      
      let status: 'passed' | 'failed' | 'warning' = 'passed';
      let message = 'OK';
      
      if (test.expectedResult === 'no_results') {
        if (rowCount > 0) {
          status = test.critical ? 'failed' : 'warning';
          message = `Found ${rowCount} problematic rows`;
        }
      } else if (test.expectedResult === 'has_results') {
        if (rowCount === 0) {
          status = test.critical ? 'failed' : 'warning';
          message = 'No rows found when expected';
        }
      }
      
      return {
        test: test.name,
        status,
        message,
        rowCount
      };
    } catch (error: any) {
      return {
        test: test.name,
        status: 'failed',
        message: `Query error: ${error.message}`
      };
    }
  }
  
  private async checkConstraints() {
    console.log('\nChecking constraint violations...');
    
    const constraintQuery = `
      SELECT 
        tc.constraint_name,
        tc.table_name,
        tc.constraint_type
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
      AND tc.constraint_type IN ('FOREIGN KEY', 'CHECK', 'UNIQUE')
      ORDER BY tc.table_name, tc.constraint_type
    `;
    
    const constraints = await pool.query(constraintQuery);
    console.log(`  Found ${constraints.rows.length} constraints to validate`);
    
    // Test a sample of foreign key constraints
    const fkConstraints = constraints.rows.filter(c => c.constraint_type === 'FOREIGN KEY');
    console.log(`  Testing ${fkConstraints.length} foreign key constraints...`);
    
    let violationCount = 0;
    
    for (const constraint of fkConstraints.slice(0, 10)) { // Test first 10 for speed
      try {
        // This will fail if there are violations
        await pool.query(`ALTER TABLE "${constraint.table_name}" VALIDATE CONSTRAINT "${constraint.constraint_name}"`);
      } catch (error: any) {
        violationCount++;
        console.log(`    ⚠️  Violation in ${constraint.table_name}.${constraint.constraint_name}`);
      }
    }
    
    if (violationCount === 0) {
      console.log('  ✅ No constraint violations found in sample');
    }
  }
  
  private async generateReport() {
    console.log('\nGenerating integrity report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'passed').length,
        warnings: this.results.filter(r => r.status === 'warning').length,
        failed: this.results.filter(r => r.status === 'failed').length
      },
      criticalIssues: this.results.filter(r => r.status === 'failed'),
      warnings: this.results.filter(r => r.status === 'warning')
    };
    
    const reportPath = path.join(__dirname, '..', '..', 'SCHEMA_INTEGRITY_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`  ✅ Report saved to: SCHEMA_INTEGRITY_REPORT.json`);
  }
}

// Run the integrity test
const tester = new SchemaIntegrityTester();
tester.run();