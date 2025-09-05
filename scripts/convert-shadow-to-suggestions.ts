#!/usr/bin/env tsx

/**
 * Convert Shadow Mode Executions to Suggestions
 * 
 * This script converts recent shadow mode pattern executions into
 * actionable suggestions for operator review in the Pattern Learning dashboard.
 */

import { db } from '../ClubOSV1-backend/src/utils/database';
import { logger } from '../ClubOSV1-backend/src/utils/logger';

async function main() {
  try {
    console.log('🔄 Converting Shadow Executions to Suggestions\n');

    // 1. Find shadow executions that should have been suggestions
    console.log('1️⃣ Finding eligible shadow executions...');
    
    const shadowExecutions = await db.query(`
      SELECT 
        peh.id as execution_id,
        peh.pattern_id,
        peh.conversation_id,
        peh.phone_number,
        peh.customer_name,
        peh.message_text,
        peh.confidence_at_execution,
        peh.response_sent,
        peh.gpt4o_reasoning,
        peh.created_at,
        dp.pattern_type,
        dp.response_template,
        dp.trigger_text
      FROM pattern_execution_history peh
      LEFT JOIN decision_patterns dp ON dp.id = peh.pattern_id
      WHERE peh.execution_mode = 'shadow'
        AND peh.created_at > NOW() - INTERVAL '7 days'
        AND peh.confidence_at_execution >= 0.60
        AND peh.confidence_at_execution < 0.85
        AND NOT EXISTS (
          SELECT 1 FROM pattern_suggestions_queue psq
          WHERE psq.conversation_id = peh.conversation_id
            AND psq.trigger_text = peh.message_text
        )
      ORDER BY peh.created_at DESC
    `);

    console.log(`✅ Found ${shadowExecutions.rows.length} shadow executions to convert\n`);

    if (shadowExecutions.rows.length === 0) {
      console.log('No eligible shadow executions found.');
      return;
    }

    // 2. Convert each shadow execution to a suggestion
    console.log('2️⃣ Converting to suggestions...\n');
    
    let converted = 0;
    let skipped = 0;

    for (const exec of shadowExecutions.rows) {
      try {
        // Generate suggested response based on pattern
        const suggestedResponse = exec.response_sent || exec.response_template || 
          'I can help you with that. Let me check the details for you.';

        // Parse reasoning if available
        let reasoning = null;
        if (exec.gpt4o_reasoning) {
          try {
            reasoning = typeof exec.gpt4o_reasoning === 'string' 
              ? exec.gpt4o_reasoning 
              : JSON.stringify(exec.gpt4o_reasoning);
          } catch (e) {
            reasoning = null;
          }
        }

        // Insert into suggestions queue
        await db.query(`
          INSERT INTO pattern_suggestions_queue (
            conversation_id,
            approved_pattern_id,
            pattern_type,
            trigger_text,
            suggested_response,
            confidence_score,
            reasoning,
            phone_number,
            status,
            created_at,
            message_timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10)
        `, [
          exec.conversation_id,
          exec.pattern_id,
          exec.pattern_type || 'general',
          exec.message_text,
          suggestedResponse,
          exec.confidence_at_execution,
          reasoning,
          exec.phone_number,
          exec.created_at, // Use original timestamp
          exec.created_at
        ]);

        converted++;
        
        // Log conversion
        console.log(`✅ Converted: ${exec.phone_number} - "${exec.message_text.substring(0, 50)}..." (${(exec.confidence_at_execution * 100).toFixed(0)}% confidence)`);
        
      } catch (err) {
        skipped++;
        console.error(`❌ Failed to convert execution ${exec.execution_id}:`, err.message);
      }
    }

    console.log(`\n3️⃣ Conversion Summary:`);
    console.log(`   ✅ Successfully converted: ${converted}`);
    console.log(`   ⏭️  Skipped (errors): ${skipped}`);

    // 3. Show current queue status
    const queueStatus = await db.query(`
      SELECT 
        COUNT(*) as total_pending,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM pattern_suggestions_queue
      WHERE status = 'pending'
    `);

    const stats = queueStatus.rows[0];
    console.log(`\n📊 Current Queue Status:`);
    console.log(`   📝 Total pending suggestions: ${stats.total_pending}`);
    if (stats.total_pending > 0) {
      console.log(`   🕐 Oldest: ${new Date(stats.oldest).toLocaleString()}`);
      console.log(`   🕐 Newest: ${new Date(stats.newest).toLocaleString()}`);
    }

    console.log('\n✨ Conversion complete!');
    console.log('   Suggestions are now available in the Pattern Learning dashboard.');
    console.log('   Go to: /operations → V3-PLS → Live tab');

  } catch (error) {
    console.error('❌ Error during conversion:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();