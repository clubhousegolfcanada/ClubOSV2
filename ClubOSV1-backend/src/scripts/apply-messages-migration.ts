#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function applyMessagesMigration() {
  console.log('🔧 Applying OpenPhone Messages Migration...\n');

  try {
    await db.initialize();
    console.log('✅ Database connected\n');

    // Check if migration is needed
    const columnCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'openphone_conversations' 
      AND column_name IN ('unread_count', 'last_read_at')
    `);

    if (columnCheck.rows.length === 2) {
      console.log('✅ Migration already applied - columns exist');
      await db.close();
      return;
    }

    console.log('📝 Applying migration...\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/017_openphone_messages_enhancement.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await db.query(statement);
        console.log('✅ Success\n');
      } catch (error: any) {
        if (error.code === '42P07' || error.message.includes('already exists')) {
          console.log('⚠️  Already exists, skipping\n');
        } else {
          throw error;
        }
      }
    }

    // Verify migration
    const verifyCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'openphone_conversations' 
      AND column_name IN ('unread_count', 'last_read_at')
    `);

    if (verifyCheck.rows.length === 2) {
      console.log('✅ Migration applied successfully!');
      console.log('✅ Messages feature is now ready to use');
    } else {
      console.error('❌ Migration may have partially failed');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run migration
applyMessagesMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});