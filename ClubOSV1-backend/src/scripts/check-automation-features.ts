import { db } from '../utils/database';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

async function checkAutomationFeatures() {
  console.log('\n=== Checking AI Automation Features ===\n');
  
  try {
    // Connect to database
    await db.connect();
    
    // Check all automation features
    const features = await db.query(`
      SELECT feature_key, feature_name, enabled, category, updated_at
      FROM ai_automation_features
      ORDER BY feature_key
    `);
    
    console.log('AI Automation Features:');
    console.log('----------------------');
    features.rows.forEach(feature => {
      const status = feature.enabled ? '✅ ENABLED' : '❌ DISABLED';
      console.log(`${status} ${feature.feature_key} - ${feature.feature_name}`);
      console.log(`   Category: ${feature.category}`);
      console.log(`   Updated: ${feature.updated_at}`);
      console.log('');
    });
    
    // Check specific features we need
    const requiredFeatures = ['llm_initial_analysis', 'llm_all_messages', 'gift_cards'];
    const missingOrDisabled = [];
    
    for (const key of requiredFeatures) {
      const feature = features.rows.find(f => f.feature_key === key);
      if (!feature || !feature.enabled) {
        missingOrDisabled.push(key);
      }
    }
    
    if (missingOrDisabled.length > 0) {
      console.log('⚠️  Required features not enabled:', missingOrDisabled.join(', '));
    } else {
      console.log('✅ All required features are enabled!');
    }
    
    // Check environment variables
    console.log('\n=== Environment Check ===');
    console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('BOOKING_ACCESS_GPT_ID:', process.env.BOOKING_ACCESS_GPT_ID ? '✅ Set' : '❌ Missing');
    console.log('OPENPHONE_DEFAULT_NUMBER:', process.env.OPENPHONE_DEFAULT_NUMBER ? '✅ Set' : '❌ Missing');
    
  } catch (error) {
    console.error('Error checking features:', error);
  } finally {
    await db.end();
  }
}

checkAutomationFeatures();