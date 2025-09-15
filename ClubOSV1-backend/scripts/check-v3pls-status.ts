#!/usr/bin/env tsx
/**
 * Check V3-PLS status
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';

// Convert internal URL to public URL
const getConnectionString = () => {
  if (DATABASE_URL.includes('postgres.railway.internal')) {
    return DATABASE_URL.replace(
      'postgres.railway.internal',
      'postgres-production-228d.up.railway.app'
    );
  }
  return DATABASE_URL;
};

const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: { rejectUnauthorized: false }
});

async function checkStatus() {
  try {
    console.log('🔍 Checking V3-PLS Status...\n');

    // 1. Check configuration
    const configResult = await pool.query(`
      SELECT config_key, config_value
      FROM pattern_learning_config
      WHERE config_key IN ('enabled', 'shadow_mode', 'include_clubai_signature')
      ORDER BY config_key
    `);

    console.log('📊 Configuration:');
    configResult.rows.forEach(row => {
      const status = row.config_value === 'true' ? '✅' : '❌';
      console.log(`  ${status} ${row.config_key}: ${row.config_value}`);
    });

    // 2. Check patterns with ClubAI signature
    const patternsResult = await pool.query(`
      SELECT
        pattern_type,
        CASE
          WHEN response_template LIKE '%- ClubAI%' THEN '✅ Has signature'
          ELSE '❌ Missing signature'
        END as signature_status,
        confidence_score,
        auto_executable
      FROM decision_patterns
      WHERE is_active = true
      ORDER BY pattern_type
    `);

    console.log('\n📋 Active Patterns:');
    patternsResult.rows.forEach(pattern => {
      console.log(`  ${pattern.pattern_type}: ${pattern.signature_status} | Confidence: ${pattern.confidence_score} | Auto: ${pattern.auto_executable}`);
    });

    // 3. Check if safeguard tables exist
    const tablesResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('operator_interventions', 'conversation_states', 'negative_sentiment_patterns')
    `);

    console.log(`\n🛡️ Safeguard Tables: ${tablesResult.rows[0].count === 3 ? '✅ All created' : '❌ Missing'}`);

    // 4. Check recent pattern executions
    const executionsResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM pattern_execution_history
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    console.log(`\n📈 Pattern Executions (last 24h): ${executionsResult.rows[0].count}`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkStatus();