#!/usr/bin/env tsx
/**
 * Enable V3-PLS Pattern Learning System in production
 * This script activates the pattern learning system and updates existing patterns
 */

import { db } from '../src/utils/database';
import { logger } from '../src/utils/logger';

async function enableV3PLS() {
  try {
    logger.info('🚀 Starting V3-PLS activation...');

    // 1. Enable pattern learning
    await db.query(`
      UPDATE pattern_learning_config
      SET config_value = 'true', updated_at = NOW()
      WHERE config_key = 'enabled'
    `);
    logger.info('✅ Pattern learning enabled');

    // 2. Disable shadow mode
    await db.query(`
      UPDATE pattern_learning_config
      SET config_value = 'false', updated_at = NOW()
      WHERE config_key = 'shadow_mode'
    `);
    logger.info('✅ Shadow mode disabled');

    // 3. Enable ClubAI signature
    await db.query(`
      UPDATE pattern_learning_config
      SET config_value = 'true', updated_at = NOW()
      WHERE config_key = 'include_clubai_signature'
    `);
    logger.info('✅ ClubAI signature enabled');

    // 4. Set thresholds
    await db.query(`
      UPDATE pattern_learning_config
      SET config_value = CASE config_key
        WHEN 'auto_execute_threshold' THEN '0.85'
        WHEN 'suggest_threshold' THEN '0.60'
        WHEN 'min_executions_for_auto' THEN '3'
        ELSE config_value
      END,
      updated_at = NOW()
      WHERE config_key IN ('auto_execute_threshold', 'suggest_threshold', 'min_executions_for_auto')
    `);
    logger.info('✅ Thresholds configured');

    // 5. Update existing patterns with ClubAI signature
    const updateResult = await db.query(`
      UPDATE decision_patterns
      SET response_template =
        CASE
          WHEN response_template LIKE '%- ClubAI%' OR response_template LIKE '%-ClubAI%'
          THEN response_template
          ELSE response_template || E'\\n\\n- ClubAI'
        END,
        last_modified = NOW()
      WHERE is_active = true
        AND (response_template NOT LIKE '%- ClubAI%'
             AND response_template NOT LIKE '%-ClubAI%')
      RETURNING id, pattern_type
    `);

    logger.info(`✅ Updated ${updateResult.rows.length} patterns with ClubAI signature`);

    // 6. Show current configuration
    const configResult = await db.query(`
      SELECT config_key, config_value
      FROM pattern_learning_config
      WHERE config_key IN (
        'enabled',
        'shadow_mode',
        'include_clubai_signature',
        'auto_execute_threshold',
        'suggest_threshold',
        'min_executions_for_auto'
      )
      ORDER BY config_key
    `);

    logger.info('📊 Current V3-PLS Configuration:');
    configResult.rows.forEach(row => {
      logger.info(`  ${row.config_key}: ${row.config_value}`);
    });

    // 7. Show active patterns
    const patternsResult = await db.query(`
      SELECT
        id,
        pattern_type,
        confidence_score,
        auto_executable,
        execution_count,
        CASE
          WHEN response_template LIKE '%- ClubAI%' THEN '✅'
          ELSE '❌'
        END as has_signature
      FROM decision_patterns
      WHERE is_active = true
        AND (is_deleted IS NULL OR is_deleted = false)
      ORDER BY confidence_score DESC
    `);

    logger.info('📋 Active Patterns:');
    patternsResult.rows.forEach(pattern => {
      logger.info(`  ID: ${pattern.id} | Type: ${pattern.pattern_type} | Confidence: ${pattern.confidence_score} | Auto: ${pattern.auto_executable} | Executions: ${pattern.execution_count} | Signature: ${pattern.has_signature}`);
    });

    // 8. Check safeguard tables
    const tablesResult = await db.query(`
      SELECT
        table_name,
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = t.table_name
        ) as exists
      FROM (
        VALUES
          ('operator_interventions'),
          ('conversation_states'),
          ('negative_sentiment_patterns')
      ) AS t(table_name)
    `);

    logger.info('🛡️ Safeguard Tables:');
    tablesResult.rows.forEach(table => {
      const status = table.exists ? '✅' : '❌';
      logger.info(`  ${status} ${table.table_name}`);
    });

    logger.info('🎉 V3-PLS activation complete!');
    logger.info('The system is now:');
    logger.info('  - Learning from operator responses');
    logger.info('  - Adding ClubAI signature to all responses');
    logger.info('  - Detecting operator takeover');
    logger.info('  - Escalating on negative sentiment');
    logger.info('  - Respecting 4-hour operator lockout');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Failed to enable V3-PLS:', error);
    process.exit(1);
  }
}

// Run the activation
enableV3PLS();