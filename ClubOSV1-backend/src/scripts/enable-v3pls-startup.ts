/**
 * Enable V3-PLS on startup if not already enabled
 * This runs during server initialization
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';

export async function enableV3PLSOnStartup() {
  try {
    // Check if V3-PLS is already enabled
    const checkResult = await db.query(`
      SELECT config_value
      FROM pattern_learning_config
      WHERE config_key = 'enabled'
    `);

    if (checkResult.rows.length > 0 && checkResult.rows[0].config_value === 'true') {
      logger.info('✅ V3-PLS already enabled');
      return;
    }

    logger.info('🚀 Enabling V3-PLS Pattern Learning System...');

    // 1. Enable pattern learning
    await db.query(`
      INSERT INTO pattern_learning_config (config_key, config_value, description)
      VALUES ('enabled', 'true', 'Master switch for pattern learning system')
      ON CONFLICT (config_key) DO UPDATE SET config_value = 'true', updated_at = NOW()
    `);

    // 2. Disable shadow mode
    await db.query(`
      INSERT INTO pattern_learning_config (config_key, config_value, description)
      VALUES ('shadow_mode', 'false', 'Run in shadow mode (log but don''t execute)')
      ON CONFLICT (config_key) DO UPDATE SET config_value = 'false', updated_at = NOW()
    `);

    // 3. Enable ClubAI signature
    await db.query(`
      INSERT INTO pattern_learning_config (config_key, config_value, description)
      VALUES ('include_clubai_signature', 'true', 'Add "- ClubAI" signature to all AI responses')
      ON CONFLICT (config_key) DO UPDATE SET config_value = 'true', updated_at = NOW()
    `);

    // 4. Set thresholds
    await db.query(`
      INSERT INTO pattern_learning_config (config_key, config_value, description)
      VALUES
        ('auto_execute_threshold', '0.85', 'Minimum confidence for auto-execution'),
        ('suggest_threshold', '0.60', 'Minimum confidence for suggestions'),
        ('min_executions_for_auto', '3', 'Minimum executions before auto-executable')
      ON CONFLICT (config_key) DO UPDATE
      SET config_value = EXCLUDED.config_value,
          description = EXCLUDED.description,
          updated_at = NOW()
    `);

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
      RETURNING id
    `);

    logger.info(`✅ V3-PLS enabled successfully!`);
    logger.info(`  - Pattern learning: ENABLED`);
    logger.info(`  - Shadow mode: DISABLED`);
    logger.info(`  - ClubAI signature: ENABLED`);
    logger.info(`  - Updated ${updateResult.rows.length} patterns with ClubAI signature`);

  } catch (error) {
    logger.error('Failed to enable V3-PLS on startup:', error);
    // Don't throw - allow server to continue starting
  }
}