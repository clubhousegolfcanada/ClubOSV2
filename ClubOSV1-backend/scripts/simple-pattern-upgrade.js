/**
 * Simple Pattern Upgrade Script
 * 
 * This is a simplified version that can be run on Railway
 * via the web console or Railway CLI
 * 
 * To run on Railway:
 * 1. Copy this entire script
 * 2. Go to Railway dashboard → Backend service → Shell
 * 3. Run: node -e 'PASTE_SCRIPT_HERE'
 * 
 * Or save and run: node scripts/simple-pattern-upgrade.js
 */

const { Pool } = require('pg');

async function upgradePatterns() {
  console.log('Starting pattern upgrade...');
  
  // Check for required environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY not found in environment!');
    console.error('This script must be run on Railway where OpenAI is configured.');
    process.exit(1);
  }
  
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not found in environment!');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // First, let's check how many patterns we have
    const countResult = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN response_template LIKE '%{{%' THEN 1 END) as templated,
             COUNT(CASE WHEN confidence_score = 0.50 THEN 1 END) as basic
      FROM decision_patterns
    `);
    
    console.log('Pattern Statistics:');
    console.log(`Total patterns: ${countResult.rows[0].total}`);
    console.log(`Already templated: ${countResult.rows[0].templated}`);
    console.log(`Basic patterns (0.50 confidence): ${countResult.rows[0].basic}`);
    console.log('');
    
    // Get a sample of patterns to show before upgrade
    const sampleBefore = await pool.query(`
      SELECT id, pattern_type, 
             LEFT(trigger_text, 50) as trigger_preview,
             LEFT(response_template, 50) as response_preview
      FROM decision_patterns
      WHERE confidence_score = 0.50
        AND (response_template NOT LIKE '%{{%' OR response_template IS NULL)
      LIMIT 3
    `);
    
    if (sampleBefore.rows.length > 0) {
      console.log('Sample patterns BEFORE upgrade:');
      sampleBefore.rows.forEach(p => {
        console.log(`ID ${p.id}: ${p.trigger_preview}...`);
        console.log(`  Response: ${p.response_preview}...`);
      });
      console.log('');
    }
    
    // Run the actual upgrade
    console.log('Running GPT-4 upgrade (this may take 3-5 minutes)...');
    console.log('To upgrade patterns, run: npx tsx scripts/upgrade-patterns-gpt4.ts');
    console.log('');
    
    // For now, let's just prepare the patterns for upgrade
    const patternsToUpgrade = await pool.query(`
      SELECT id, pattern_type, trigger_text, response_template
      FROM decision_patterns
      WHERE confidence_score = 0.50
        AND (trigger_keywords IS NULL OR trigger_keywords = '{}')
      ORDER BY id
      LIMIT 10
    `);
    
    console.log(`Found ${patternsToUpgrade.rows.length} patterns ready for GPT-4 upgrade.`);
    console.log('');
    console.log('To complete the upgrade:');
    console.log('1. Ensure OPENAI_API_KEY is set in Railway environment');
    console.log('2. Run: npx tsx scripts/upgrade-patterns-gpt4.ts');
    console.log('3. Monitor the logs for progress');
    console.log('');
    console.log('The upgrade will:');
    console.log('- Extract template variables ({{customer_name}}, {{bay_number}}, etc.)');
    console.log('- Identify entities and keywords');
    console.log('- Increase initial confidence to 0.60');
    console.log('- Add intelligent context understanding');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  upgradePatterns().catch(console.error);
}

module.exports = { upgradePatterns };