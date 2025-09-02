#!/usr/bin/env node

/**
 * Monitor Pattern Upgrade Progress
 * Run this to check how the GPT-4 upgrade is progressing
 */

const { Pool } = require('pg');
require('dotenv').config();

async function monitorProgress() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  const startTime = Date.now();
  let lastUpgraded = 0;
  
  console.log('🔄 Monitoring Pattern Upgrade Progress...');
  console.log('Press Ctrl+C to stop monitoring\n');
  
  const checkProgress = async () => {
    try {
      const stats = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN response_template LIKE '%{{%' THEN 1 END) as upgraded,
          COUNT(CASE WHEN confidence_score = 0.50 THEN 1 END) as remaining,
          COUNT(CASE WHEN confidence_score > 0.50 THEN 1 END) as enhanced
        FROM decision_patterns
        WHERE is_active = true
      `);
      
      const s = stats.rows[0];
      const progress = Math.round((s.upgraded / s.total) * 100);
      const newlyUpgraded = s.upgraded - lastUpgraded;
      
      // Clear previous line and show update
      process.stdout.write('\r\x1b[K'); // Clear line
      process.stdout.write(
        `📊 Progress: ${s.upgraded}/${s.total} patterns (${progress}%) | ` +
        `Enhanced: ${s.enhanced} | ` +
        `Remaining: ${s.remaining} | ` +
        `Speed: ${newlyUpgraded > 0 ? '+' + newlyUpgraded : '0'}/check`
      );
      
      lastUpgraded = s.upgraded;
      
      // If complete, show final stats
      if (s.remaining === 0 || progress === 100) {
        console.log('\n\n✅ Upgrade Complete!\n');
        
        // Show pattern type breakdown
        const types = await pool.query(`
          SELECT 
            pattern_type,
            COUNT(*) as count,
            AVG(confidence_score) as avg_conf,
            COUNT(CASE WHEN response_template LIKE '%{{%' THEN 1 END) as templated
          FROM decision_patterns
          GROUP BY pattern_type
          ORDER BY count DESC
        `);
        
        console.log('Pattern Types:');
        types.rows.forEach(t => {
          console.log(`  ${t.pattern_type}: ${t.count} patterns (${t.templated} templated, avg conf: ${parseFloat(t.avg_conf).toFixed(2)})`);
        });
        
        // Show sample upgraded patterns
        const samples = await pool.query(`
          SELECT 
            pattern_type,
            LEFT(trigger_text, 50) as trigger,
            response_template
          FROM decision_patterns
          WHERE response_template LIKE '%{{%'
          LIMIT 3
        `);
        
        if (samples.rows.length > 0) {
          console.log('\nSample Upgraded Patterns:');
          samples.rows.forEach((p, i) => {
            console.log(`\n${i + 1}. ${p.pattern_type}:`);
            console.log(`   Trigger: "${p.trigger}..."`);
            console.log(`   Template: "${p.response_template}"`);
          });
        }
        
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`\nTotal time: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
        
        await pool.end();
        process.exit(0);
      }
      
    } catch (error) {
      console.error('\nError checking progress:', error.message);
    }
  };
  
  // Check immediately, then every 5 seconds
  await checkProgress();
  const interval = setInterval(checkProgress, 5000);
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', async () => {
    clearInterval(interval);
    console.log('\n\n⏸️  Monitoring stopped');
    await pool.end();
    process.exit(0);
  });
}

monitorProgress().catch(console.error);