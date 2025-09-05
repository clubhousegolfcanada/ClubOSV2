#!/usr/bin/env tsx

/**
 * Fix Missing Queue Entries
 * This script creates pattern_suggestions_queue entries for messages that show as 'queued'
 * in pattern_execution_history but don't have corresponding queue entries.
 */

import { db } from '../ClubOSV1-backend/src/utils/database';

async function main() {
  try {
    console.log('🔧 Fixing missing queue entries...\n');

    // Find all pattern executions with mode='queued' or 'suggested' that don't have queue entries
    const missingEntries = await db.query(`
      SELECT DISTINCT
        peh.id,
        peh.pattern_id,
        peh.conversation_id,
        peh.phone_number,
        peh.message_text,
        peh.confidence_at_execution,
        peh.execution_mode,
        peh.response_sent,
        peh.gpt4o_reasoning,
        peh.created_at,
        dp.pattern_type,
        dp.response_template
      FROM pattern_execution_history peh
      LEFT JOIN decision_patterns dp ON dp.id = peh.pattern_id
      LEFT JOIN pattern_suggestions_queue psq ON 
        psq.conversation_id = peh.conversation_id 
        AND psq.approved_pattern_id = peh.pattern_id
      WHERE peh.execution_mode IN ('queued', 'suggested')
        AND psq.id IS NULL
        AND peh.created_at > NOW() - INTERVAL '7 days'
      ORDER BY peh.created_at DESC
    `);

    console.log(`Found ${missingEntries.rows.length} missing queue entries\n`);

    let created = 0;
    let failed = 0;

    for (const entry of missingEntries.rows) {
      try {
        // Create the missing queue entry
        await db.query(`
          INSERT INTO pattern_suggestions_queue 
          (conversation_id, approved_pattern_id, pattern_type, trigger_text, 
           suggested_response, confidence_score, reasoning, phone_number, 
           status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
          ON CONFLICT DO NOTHING
        `, [
          entry.conversation_id,
          entry.pattern_id,
          entry.pattern_type || 'general',
          entry.message_text,
          entry.response_sent || entry.response_template || 'Response pending',
          entry.confidence_at_execution || 0.7,
          entry.gpt4o_reasoning || JSON.stringify({ 
            thought_process: 'Retroactively queued for review',
            next_steps: ['Review and approve or modify response'],
            confidence_explanation: 'Pattern matched with moderate confidence'
          }),
          entry.phone_number,
          entry.created_at
        ]);
        
        created++;
        console.log(`✅ Created queue entry for ${entry.phone_number} (${entry.pattern_type})`);
      } catch (err) {
        failed++;
        console.error(`❌ Failed for ${entry.phone_number}:`, err.message);
      }
    }

    console.log(`\n✨ Complete!`);
    console.log(`   Created: ${created} queue entries`);
    console.log(`   Failed: ${failed}`);
    console.log(`\n📱 Check the V3-PLS page - Pending Suggestions should now show these items`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();