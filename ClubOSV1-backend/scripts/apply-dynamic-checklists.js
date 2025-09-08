#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function applyMigration() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🚀 Applying dynamic checklists migration...\n');
    
    // 1. Create checklist templates table
    console.log('1. Creating checklist_templates table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS checklist_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL CHECK (category IN ('cleaning', 'tech')),
        type VARCHAR(50) NOT NULL CHECK (type IN ('daily', 'weekly', 'quarterly')),
        location VARCHAR(255),
        active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 2. Create checklist tasks table
    console.log('2. Creating checklist_tasks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS checklist_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID REFERENCES checklist_templates(id) ON DELETE CASCADE,
        task_text VARCHAR(500) NOT NULL,
        position INT NOT NULL,
        is_required BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(template_id, position)
      )
    `);
    
    // 3. Add columns to checklist_submissions
    console.log('3. Updating checklist_submissions table...');
    await client.query(`
      ALTER TABLE checklist_submissions 
      ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES checklist_templates(id),
      ADD COLUMN IF NOT EXISTS door_unlocked_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'abandoned'))
    `);
    
    // Add computed duration column
    await client.query(`
      ALTER TABLE checklist_submissions 
      ADD COLUMN IF NOT EXISTS duration_minutes INT GENERATED ALWAYS AS (
        CASE 
          WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (completed_at - started_at))/60::INT
          ELSE NULL 
        END
      ) STORED
    `);
    
    // 4. Create door unlock audit table
    console.log('4. Creating checklist_door_unlocks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS checklist_door_unlocks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        location VARCHAR(255) NOT NULL,
        unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checklist_submission_id UUID REFERENCES checklist_submissions(id),
        unifi_response JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 5. Add location permissions to users
    console.log('5. Adding location permissions to users...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS allowed_locations TEXT[] DEFAULT ARRAY[]::TEXT[]
    `);
    
    // 6. Create indexes
    console.log('6. Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_checklist_templates_location ON checklist_templates(location);
      CREATE INDEX IF NOT EXISTS idx_checklist_templates_category_type ON checklist_templates(category, type);
      CREATE INDEX IF NOT EXISTS idx_checklist_tasks_template_position ON checklist_tasks(template_id, position);
      CREATE INDEX IF NOT EXISTS idx_checklist_submissions_template ON checklist_submissions(template_id);
      CREATE INDEX IF NOT EXISTS idx_checklist_submissions_status ON checklist_submissions(status);
      CREATE INDEX IF NOT EXISTS idx_checklist_door_unlocks_user_location ON checklist_door_unlocks(user_id, location);
    `);
    
    // 7. Insert default templates
    console.log('7. Inserting default templates...');
    const templates = [
      { name: 'Daily Cleaning', category: 'cleaning', type: 'daily' },
      { name: 'Weekly Cleaning', category: 'cleaning', type: 'weekly' },
      { name: 'Quarterly Cleaning', category: 'cleaning', type: 'quarterly' },
      { name: 'Weekly Tech Maintenance', category: 'tech', type: 'weekly' },
      { name: 'Quarterly Tech Maintenance', category: 'tech', type: 'quarterly' }
    ];
    
    for (const template of templates) {
      const result = await client.query(`
        INSERT INTO checklist_templates (name, category, type, location) 
        VALUES ($1, $2, $3, NULL)
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [template.name, template.category, template.type]);
      
      if (result.rows.length > 0) {
        console.log(`  ✓ Created template: ${template.name}`);
      }
    }
    
    // 8. Insert tasks for each template
    console.log('8. Inserting tasks for templates...');
    
    // Daily Cleaning tasks
    const dailyCleaningId = await client.query(`
      SELECT id FROM checklist_templates 
      WHERE category = 'cleaning' AND type = 'daily' AND location IS NULL 
      LIMIT 1
    `);
    
    if (dailyCleaningId.rows.length > 0) {
      const dailyTasks = [
        'Replace practice balls',
        'Empty all garbage bins',
        'Clean and restock bathrooms',
        'Refill water stations',
        'Check and clean hitting mats',
        'Wipe down screens'
      ];
      
      for (let i = 0; i < dailyTasks.length; i++) {
        await client.query(`
          INSERT INTO checklist_tasks (template_id, task_text, position)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `, [dailyCleaningId.rows[0].id, dailyTasks[i], i + 1]);
      }
      console.log('  ✓ Added daily cleaning tasks');
    }
    
    // Weekly Cleaning tasks
    const weeklyCleaningId = await client.query(`
      SELECT id FROM checklist_templates 
      WHERE category = 'cleaning' AND type = 'weekly' AND location IS NULL 
      LIMIT 1
    `);
    
    if (weeklyCleaningId.rows.length > 0) {
      const weeklyTasks = [
        'Deep clean all bays',
        'Vacuum entire facility',
        'Clean all windows',
        'Inspect and clean equipment',
        'Organize storage areas',
        'Check HVAC filters'
      ];
      
      for (let i = 0; i < weeklyTasks.length; i++) {
        await client.query(`
          INSERT INTO checklist_tasks (template_id, task_text, position)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `, [weeklyCleaningId.rows[0].id, weeklyTasks[i], i + 1]);
      }
      console.log('  ✓ Added weekly cleaning tasks');
    }
    
    // Tech Weekly tasks
    const techWeeklyId = await client.query(`
      SELECT id FROM checklist_templates 
      WHERE category = 'tech' AND type = 'weekly' AND location IS NULL 
      LIMIT 1
    `);
    
    if (techWeeklyId.rows.length > 0) {
      const techTasks = [
        'Update TrackMan software',
        'Check all cable connections',
        'Clean projector lenses',
        'Run system diagnostics',
        'Test network connectivity',
        'Verify backup systems'
      ];
      
      for (let i = 0; i < techTasks.length; i++) {
        await client.query(`
          INSERT INTO checklist_tasks (template_id, task_text, position)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `, [techWeeklyId.rows[0].id, techTasks[i], i + 1]);
      }
      console.log('  ✓ Added tech weekly tasks');
    }
    
    // 9. Grant location access to admin users
    console.log('9. Granting location access to admin users...');
    await client.query(`
      UPDATE users 
      SET allowed_locations = ARRAY['Bedford', 'Dartmouth', 'Stratford', 'Bayers Lake', 'Truro']
      WHERE role = 'admin' AND (allowed_locations IS NULL OR allowed_locations = '{}')
    `);
    
    await client.query('COMMIT');
    console.log('\n✅ Dynamic checklists migration completed successfully!');
    
    // Show summary
    const templateCount = await client.query('SELECT COUNT(*) FROM checklist_templates');
    const taskCount = await client.query('SELECT COUNT(*) FROM checklist_tasks');
    
    console.log(`\n📊 Summary:`);
    console.log(`  - Templates created: ${templateCount.rows[0].count}`);
    console.log(`  - Tasks created: ${taskCount.rows[0].count}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();