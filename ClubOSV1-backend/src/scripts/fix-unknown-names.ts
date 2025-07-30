#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { db } from '../utils/database';

dotenv.config();

async function fixUnknownNames() {
  console.log('🔧 Updating "Unknown" customer names to phone numbers...\n');

  try {
    await db.initialize();
    console.log('✅ Database connected\n');

    // Update all "Unknown" customer names to use phone number
    const result = await db.query(`
      UPDATE openphone_conversations 
      SET customer_name = phone_number 
      WHERE customer_name = 'Unknown' OR customer_name IS NULL
      RETURNING id, phone_number
    `);

    console.log(`✅ Updated ${result.rows.length} conversations\n`);
    
    if (result.rows.length > 0) {
      console.log('Updated conversations:');
      result.rows.forEach(row => {
        console.log(`   • ${row.phone_number}`);
      });
    }

  } catch (error) {
    console.error('❌ Error updating names:', error);
  } finally {
    await db.close();
  }
}

// Run fix
fixUnknownNames().catch(console.error);