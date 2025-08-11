#!/usr/bin/env npx tsx
/**
 * Test script to check knowledge-related database tables
 * Run with: npm run test:knowledge-tables
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { pool, query } from '../src/utils/db';
import { logger } from '../src/utils/logger';

async function testKnowledgeTables() {
  try {
    console.log('\n🔍 Testing Knowledge Database Tables\n');
    console.log('='.repeat(50));
    
    // Test database connection
    const testQuery = await query('SELECT NOW()');
    if (!testQuery.rows[0]) {
      console.error('❌ Database not connected');
      process.exit(1);
    }
    
    console.log('✅ Database connected\n');
    
    // Tables to check
    const tables = [
      'assistant_knowledge',
      'knowledge_audit_log', 
      'extracted_knowledge',
      'knowledge_captures',
      'sop_embeddings',
      'sop_metrics',
      'sop_shadow_comparisons'
    ];
    
    console.log('Checking tables:');
    console.log('-'.repeat(50));
    
    for (const table of tables) {
      try {
        const result = await query(
          `SELECT COUNT(*) as count FROM ${table}`
        );
        const count = result.rows[0].count;
        console.log(`✅ ${table.padEnd(30)} - ${count} records`);
      } catch (error: any) {
        if (error.message.includes('does not exist')) {
          console.log(`❌ ${table.padEnd(30)} - TABLE DOES NOT EXIST`);
        } else {
          console.log(`⚠️  ${table.padEnd(30)} - Error: ${error.message}`);
        }
      }
    }
    
    // Check latest entries in key tables
    console.log('\n📊 Latest Knowledge Entries:');
    console.log('-'.repeat(50));
    
    // Check assistant_knowledge
    try {
      const assistantKnowledge = await query(`
        SELECT assistant_id, route, created_at 
        FROM assistant_knowledge 
        ORDER BY created_at DESC 
        LIMIT 3
      `);
      
      if (assistantKnowledge.rows.length > 0) {
        console.log('\nAssistant Knowledge (latest 3):');
        assistantKnowledge.rows.forEach(row => {
          console.log(`  - ${row.route} (${row.assistant_id.substring(0, 10)}...) - ${new Date(row.created_at).toLocaleDateString()}`);
        });
      } else {
        console.log('\nAssistant Knowledge: No entries found');
      }
    } catch (error) {
      console.log('\nAssistant Knowledge: Error reading table');
    }
    
    // Check knowledge_audit_log
    try {
      const auditLog = await query(`
        SELECT action, assistant_target, category, timestamp 
        FROM knowledge_audit_log 
        ORDER BY timestamp DESC 
        LIMIT 3
      `);
      
      if (auditLog.rows.length > 0) {
        console.log('\nKnowledge Audit Log (latest 3):');
        auditLog.rows.forEach(row => {
          console.log(`  - ${row.action} ${row.category} for ${row.assistant_target} - ${new Date(row.timestamp).toLocaleDateString()}`);
        });
      } else {
        console.log('\nKnowledge Audit Log: No entries found');
      }
    } catch (error) {
      console.log('\nKnowledge Audit Log: Error reading table');
    }
    
    // Check extracted_knowledge
    try {
      const extracted = await query(`
        SELECT category, problem, confidence 
        FROM extracted_knowledge 
        WHERE applied_to_sop = false
        ORDER BY created_at DESC 
        LIMIT 3
      `);
      
      if (extracted.rows.length > 0) {
        console.log('\nExtracted Knowledge (unapplied, latest 3):');
        extracted.rows.forEach(row => {
          console.log(`  - ${row.category}: "${row.problem?.substring(0, 50)}..." (confidence: ${row.confidence})`);
        });
      } else {
        console.log('\nExtracted Knowledge: No unapplied entries found');
      }
    } catch (error) {
      console.log('\nExtracted Knowledge: Error reading table');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Test complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Run the test
testKnowledgeTables();