import { query } from '../src/utils/db';

async function checkFeatureSchema() {
  console.log('=== CHECKING AI AUTOMATION FEATURES SCHEMA ===\n');
  
  try {
    // 1. Check if table exists
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'ai_automation_features'
      )
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ ai_automation_features table does not exist!');
      return;
    }
    
    // 2. Get column names
    const columns = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ai_automation_features'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in ai_automation_features:');
    columns.rows.forEach(c => {
      console.log(`  - ${c.column_name}: ${c.data_type}`);
    });
    
    // 3. Get actual data
    console.log('\n\nActual data in ai_automation_features:');
    const features = await query(`
      SELECT * FROM ai_automation_features
    `);
    
    if (features.rows.length === 0) {
      console.log('  No features found in table');
    } else {
      features.rows.forEach(f => {
        console.log(`\n  Feature: ${f.feature_key || f.key || 'NO KEY'}`);
        Object.keys(f).forEach(key => {
          if (key !== 'feature_key' && key !== 'key') {
            console.log(`    ${key}: ${f[key]}`);
          }
        });
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkFeatureSchema();