import dotenv from 'dotenv';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

dotenv.config();

async function checkGiftCardKnowledge() {
  try {
    await db.initialize();
    
    console.log('🔍 Checking Gift Card Knowledge in Database...');
    console.log('==========================================\n');

    // 1. Check knowledge_audit_log
    console.log('1. Knowledge audit log entries for gift cards:');
    const knowledgeResult = await db.query(`
      SELECT id, category, key, new_value, assistant_target, created_at 
      FROM knowledge_audit_log 
      WHERE LOWER(new_value) LIKE '%gift%card%' 
         OR LOWER(new_value) LIKE '%giftcard%'
         OR LOWER(category) LIKE '%gift%' 
         OR LOWER(key) LIKE '%gift%' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (knowledgeResult.rows.length > 0) {
      knowledgeResult.rows.forEach((row, i) => {
        console.log(`\n  Entry ${i + 1}:`);
        console.log(`    Category: ${row.category}`);
        console.log(`    Key: ${row.key || 'N/A'}`);
        console.log(`    Value: ${row.new_value.substring(0, 100)}...`);
        console.log(`    Target: ${row.assistant_target}`);
        console.log(`    Created: ${row.created_at}`);
      });
    } else {
      console.log('  ❌ No gift card knowledge found in audit log');
    }

    // 2. Check automation status
    console.log('\n\n2. Gift card automation status:');
    const automationResult = await db.query(`
      SELECT feature_key, feature_name, enabled, config 
      FROM ai_automation_features 
      WHERE feature_key = 'gift_cards'
    `);
    
    if (automationResult.rows.length > 0) {
      const feature = automationResult.rows[0];
      console.log(`  Feature: ${feature.feature_name}`);
      console.log(`  Enabled: ${feature.enabled ? '✅ YES' : '❌ NO'}`);
      console.log(`  Config: ${JSON.stringify(feature.config, null, 2)}`);
    } else {
      console.log('  ❌ Gift card automation feature not found');
    }

    // 3. Check recent automation usage
    console.log('\n\n3. Recent gift card automation attempts:');
    const usageResult = await db.query(`
      SELECT au.*, af.feature_name
      FROM ai_automation_usage au
      JOIN ai_automation_features af ON au.feature_id = af.id
      WHERE af.feature_key = 'gift_cards'
      ORDER BY au.created_at DESC
      LIMIT 5
    `);
    
    if (usageResult.rows.length > 0) {
      usageResult.rows.forEach((row, i) => {
        console.log(`\n  Attempt ${i + 1}:`);
        console.log(`    Success: ${row.success ? '✅' : '❌'}`);
        console.log(`    Trigger: ${row.trigger_type}`);
        console.log(`    Error: ${row.error_message || 'None'}`);
        console.log(`    Created: ${row.created_at}`);
      });
    } else {
      console.log('  No automation usage found');
    }

    // 4. Test knowledge search
    console.log('\n\n4. Testing knowledge search for "gift cards":');
    const searchTerms = ['gift', 'card', 'giftcard', 'gift card'];
    const searchResult = await db.query(`
      SELECT * FROM knowledge_audit_log
      WHERE LOWER(new_value) LIKE ANY($1)
      ORDER BY created_at DESC
      LIMIT 1
    `, [searchTerms.map(term => `%${term}%`)]);
    
    if (searchResult.rows.length > 0) {
      console.log('  ✅ Knowledge search would find:');
      console.log(`    ${searchResult.rows[0].new_value.substring(0, 200)}...`);
    } else {
      console.log('  ❌ Knowledge search returns no results');
    }

    console.log('\n\n✅ Audit complete!');
    
  } catch (error) {
    logger.error('Failed to check gift card knowledge:', error);
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

checkGiftCardKnowledge();