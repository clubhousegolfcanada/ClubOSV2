#!/usr/bin/env npx tsx

import { db } from '../src/utils/database';

async function verifyTables() {
  try {
    console.log('Checking if push notification tables exist...\n');
    
    await db.initialize();
    
    // Check for push_subscriptions table
    const tablesResult = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('push_subscriptions', 'notification_history', 'notification_preferences')
    `);
    
    const existingTables = tablesResult.rows.map(r => r.table_name);
    
    const requiredTables = ['push_subscriptions', 'notification_history', 'notification_preferences'];
    
    requiredTables.forEach(table => {
      if (existingTables.includes(table)) {
        console.log(`✅ Table '${table}' exists`);
      } else {
        console.log(`❌ Table '${table}' does not exist (will be created by migration)`);
      }
    });
    
    // Check migrations table
    const migrationResult = await db.query(`
      SELECT version, name, applied_at 
      FROM migrations 
      WHERE version = 19
    `);
    
    if (migrationResult.rows.length > 0) {
      console.log('\n⚠️  Migration 19 already applied:', migrationResult.rows[0]);
    } else {
      console.log('\n✅ Migration 19 not yet applied - ready to run');
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

verifyTables();