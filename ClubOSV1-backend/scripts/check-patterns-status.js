#!/usr/bin/env node

/**
 * Check Pattern Status in Railway Database
 * This script connects to Railway and shows the current state of patterns
 */

const { Pool } = require('pg');
require('dotenv').config();

async function checkPatternStatus() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('========================================');
    console.log('V3-PLS Pattern Status Check');
    console.log('========================================\n');
    
    // Get overall statistics
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_patterns,
        COUNT(CASE WHEN response_template LIKE '%{{%' THEN 1 END) as templated_patterns,
        COUNT(CASE WHEN confidence_score = 0.50 THEN 1 END) as basic_patterns,
        COUNT(CASE WHEN confidence_score > 0.50 THEN 1 END) as enhanced_patterns,
        COUNT(CASE WHEN auto_executable = true THEN 1 END) as auto_executable,
        AVG(confidence_score) as avg_confidence,
        MAX(confidence_score) as max_confidence
      FROM decision_patterns
      WHERE is_active = true
    `);
    
    const s = stats.rows[0];
    console.log('📊 Pattern Statistics:');
    console.log(`├─ Total patterns: ${s.total_patterns}`);
    console.log(`├─ Templated (with variables): ${s.templated_patterns} (${Math.round(s.templated_patterns/s.total_patterns*100)}%)`);
    console.log(`├─ Basic (0.50 confidence): ${s.basic_patterns}`);
    console.log(`├─ Enhanced (>0.50 confidence): ${s.enhanced_patterns}`);
    console.log(`├─ Auto-executable: ${s.auto_executable}`);
    console.log(`├─ Average confidence: ${parseFloat(s.avg_confidence).toFixed(2)}`);
    console.log(`└─ Max confidence: ${parseFloat(s.max_confidence).toFixed(2)}\n`);
    
    // Get pattern type breakdown
    const types = await pool.query(`
      SELECT 
        pattern_type,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence,
        COUNT(CASE WHEN response_template LIKE '%{{%' THEN 1 END) as templated
      FROM decision_patterns
      WHERE is_active = true
      GROUP BY pattern_type
      ORDER BY count DESC
    `);
    
    console.log('📋 Patterns by Type:');
    types.rows.forEach(t => {
      console.log(`├─ ${t.pattern_type}: ${t.count} patterns (${t.templated} templated, avg conf: ${parseFloat(t.avg_confidence).toFixed(2)})`);
    });
    console.log('');
    
    // Show sample patterns that need upgrading
    const needsUpgrade = await pool.query(`
      SELECT 
        id,
        pattern_type,
        LEFT(trigger_text, 60) as trigger,
        LEFT(response_template, 60) as response
      FROM decision_patterns
      WHERE confidence_score = 0.50
        AND (response_template NOT LIKE '%{{%' OR response_template IS NULL)
        AND is_active = true
      LIMIT 5
    `);
    
    if (needsUpgrade.rows.length > 0) {
      console.log('⚠️  Sample Patterns Needing GPT-4 Upgrade:');
      needsUpgrade.rows.forEach((p, i) => {
        console.log(`\n${i + 1}. Pattern #${p.id} (${p.pattern_type}):`);
        console.log(`   Trigger: "${p.trigger}..."`);
        console.log(`   Response: "${p.response}..."`);
      });
      console.log('');
    }
    
    // Show sample upgraded patterns
    const upgraded = await pool.query(`
      SELECT 
        id,
        pattern_type,
        LEFT(trigger_text, 60) as trigger,
        response_template,
        confidence_score
      FROM decision_patterns
      WHERE response_template LIKE '%{{%'
        AND is_active = true
      LIMIT 3
    `);
    
    if (upgraded.rows.length > 0) {
      console.log('✅ Sample Upgraded Patterns (with templates):');
      upgraded.rows.forEach((p, i) => {
        console.log(`\n${i + 1}. Pattern #${p.id} (${p.pattern_type}, conf: ${p.confidence_score}):`);
        console.log(`   Trigger: "${p.trigger}..."`);
        console.log(`   Template: "${p.response_template}"`);
      });
      console.log('');
    }
    
    // Check recent pattern learning activity
    const recentActivity = await pool.query(`
      SELECT 
        COUNT(*) as executions_today,
        COUNT(DISTINCT pattern_id) as patterns_used_today
      FROM pattern_execution_history
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    
    if (recentActivity.rows[0].executions_today > 0) {
      console.log('📈 Recent Activity (last 24 hours):');
      console.log(`├─ Pattern executions: ${recentActivity.rows[0].executions_today}`);
      console.log(`└─ Unique patterns used: ${recentActivity.rows[0].patterns_used_today}\n`);
    }
    
    // Final recommendation
    console.log('========================================');
    if (s.basic_patterns > 0) {
      console.log('🎯 RECOMMENDATION: Run GPT-4 Upgrade');
      console.log(`   ${s.basic_patterns} patterns need upgrading to use template variables.`);
      console.log('   This will enable dynamic responses instead of static text.\n');
      console.log('   Next steps:');
      console.log('   1. Run on Railway: node scripts/railway-pattern-upgrade.js');
      console.log('   2. Or via Railway CLI: railway run node scripts/upgrade-patterns-gpt4.ts');
      console.log('   3. Check results with this script again');
    } else if (s.templated_patterns === s.total_patterns) {
      console.log('✅ All patterns have been upgraded with templates!');
      console.log('   Ready for semantic matching implementation.');
    } else {
      console.log('📊 Pattern system is partially upgraded.');
      console.log(`   ${s.templated_patterns}/${s.total_patterns} patterns use templates.`);
    }
    console.log('========================================');
    
  } catch (error) {
    console.error('Error connecting to database:', error.message);
    console.error('\nMake sure DATABASE_URL is set in .env file');
  } finally {
    await pool.end();
  }
}

// Run the check
checkPatternStatus().catch(console.error);