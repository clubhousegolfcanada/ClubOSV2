// This file will be run once on the server to initialize contractor support
import { query } from './utils/db';

async function initializeContractorSupport() {
  console.log('Initializing contractor role support...\n');
  
  try {
    // 1. Update role constraint
    console.log('Step 1: Updating role constraint...');
    await query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    await query(`
      ALTER TABLE users ADD CONSTRAINT users_role_check 
      CHECK (role IN ('admin', 'operator', 'support', 'kiosk', 'customer', 'contractor'))
    `);
    console.log('✅ Role constraint updated');
    
    // 2. Create contractor_permissions table
    console.log('\nStep 2: Creating contractor_permissions table...');
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
      )
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_contractor_permissions_user_location 
      ON contractor_permissions(user_id, location)
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_contractor_permissions_active 
      ON contractor_permissions(active_from, active_until)
    `);
    console.log('✅ contractor_permissions table created');
    
    // 3. Create contractor_checklist_submissions table
    console.log('\nStep 3: Creating contractor_checklist_submissions table...');
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
      )
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_contractor_submissions_contractor 
      ON contractor_checklist_submissions(contractor_id)
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_contractor_submissions_location 
      ON contractor_checklist_submissions(contractor_id, location)
    `);
    console.log('✅ contractor_checklist_submissions table created');
    
    console.log('\n✅✅✅ CONTRACTOR SUPPORT INITIALIZED SUCCESSFULLY ✅✅✅');
    
    return { success: true, message: 'Contractor support initialized' };
    
  } catch (error: any) {
    console.error('❌ Initialization failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export for API endpoint
export default initializeContractorSupport;