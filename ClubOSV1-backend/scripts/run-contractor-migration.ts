import { query } from '../src/utils/db';
import fs from 'fs';
import path from 'path';

async function runContractorMigration() {
  console.log('Running migration: Add contractor role support...\n');
  
  try {
    // Check current constraint
    console.log('Checking current role constraint...');
    const constraintCheck = await query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname LIKE '%role%' 
      AND conrelid = 'users'::regclass
    `);
    
    console.log('Current constraints:', constraintCheck.rows);
    
    // Drop existing constraint and add new one with contractor
    console.log('\nUpdating role constraint to include contractor...');
    await query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    `);
    
    await query(`
      ALTER TABLE users ADD CONSTRAINT users_role_check 
      CHECK (role IN ('admin', 'operator', 'support', 'kiosk', 'customer', 'contractor'));
    `);
    
    console.log('✅ Role constraint updated!\n');
    
    // Create contractor_permissions table
    console.log('Creating contractor_permissions table...');
    await query(`
      CREATE TABLE IF NOT EXISTS contractor_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        location VARCHAR(100) NOT NULL,
        can_unlock_doors BOOLEAN DEFAULT true,
        can_submit_checklists BOOLEAN DEFAULT true,
        can_view_history BOOLEAN DEFAULT false,
        active_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        active_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id),
        UNIQUE(user_id, location)
      );
    `);
    
    // Add indexes
    await query(`
      CREATE INDEX IF NOT EXISTS idx_contractor_permissions_user_location 
      ON contractor_permissions(user_id, location);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_contractor_permissions_active 
      ON contractor_permissions(active_from, active_until);
    `);
    
    console.log('✅ contractor_permissions table created!\n');
    
    // Create contractor_checklist_submissions table
    console.log('Creating contractor_checklist_submissions table...');
    await query(`
      CREATE TABLE IF NOT EXISTS contractor_checklist_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contractor_id UUID NOT NULL REFERENCES users(id),
        checklist_submission_id UUID REFERENCES checklist_submissions(id),
        location VARCHAR(100) NOT NULL,
        door_unlocks JSONB DEFAULT '[]',
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Add indexes
    await query(`
      CREATE INDEX IF NOT EXISTS idx_contractor_submissions_contractor 
      ON contractor_checklist_submissions(contractor_id);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_contractor_submissions_location 
      ON contractor_checklist_submissions(contractor_id, location);
    `);
    
    console.log('✅ contractor_checklist_submissions table created!\n');
    
    // Verify the migration
    console.log('Verifying migration...');
    
    // Check constraint
    const newConstraintCheck = await query(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'users_role_check' 
      AND conrelid = 'users'::regclass
    `);
    
    if (newConstraintCheck.rows.length > 0) {
      console.log('✅ Role constraint:', newConstraintCheck.rows[0].definition);
    }
    
    // Check tables exist
    const tablesCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('contractor_permissions', 'contractor_checklist_submissions')
    `);
    
    const hasPermissions = tablesCheck.rows.some(r => r.table_name === 'contractor_permissions');
    const hasSubmissions = tablesCheck.rows.some(r => r.table_name === 'contractor_checklist_submissions');
    
    console.log(`\n✅ contractor_permissions table: ${hasPermissions ? 'EXISTS' : 'MISSING'}`);
    console.log(`✅ contractor_checklist_submissions table: ${hasSubmissions ? 'EXISTS' : 'MISSING'}`);
    
    if (hasPermissions && hasSubmissions) {
      console.log('\n✅✅✅ Migration completed successfully! ✅✅✅');
      console.log('\nYou can now create contractor users through the Operations Center.');
    } else {
      console.error('\n❌ Some tables may be missing');
    }
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) console.error('Details:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the migration
runContractorMigration();