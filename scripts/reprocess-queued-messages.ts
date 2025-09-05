#!/usr/bin/env tsx

/**
 * Reprocess Queued Messages with GPT-4o
 * This script deletes the bad retroactive entries and properly reprocesses them
 */

import { db } from '../ClubOSV1-backend/src/utils/database';
import { patternLearningService } from '../ClubOSV1-backend/src/services/patternLearningService';

async function main() {
  try {
    console.log('🔧 Reprocessing queued messages with GPT-4o...\n');

    // First, delete the bad retroactive entries we just created
    const deleteResult = await db.query(`
      DELETE FROM pattern_suggestions_queue 
      WHERE reasoning::text LIKE '%Retroactively queued for review%'
      RETURNING id, phone_number, trigger_text
    `);
    
    console.log(`Deleted ${deleteResult.rows.length} bad retroactive entries\n`);

    // Now get the messages that need proper processing
    const messagesToProcess = await db.query(`
      SELECT DISTINCT
        peh.conversation_id,
        peh.phone_number,
        peh.message_text,
        oc.customer_name,
        peh.created_at
      FROM pattern_execution_history peh
      LEFT JOIN openphone_conversations oc ON oc.id::text = peh.conversation_id
      LEFT JOIN pattern_suggestions_queue psq ON 
        psq.conversation_id = peh.conversation_id 
        AND psq.trigger_text = peh.message_text
      WHERE peh.execution_mode IN ('queued', 'suggested')
        AND psq.id IS NULL
        AND peh.created_at > NOW() - INTERVAL '7 days'
      ORDER BY peh.created_at DESC
    `);

    console.log(`Found ${messagesToProcess.rows.length} messages to reprocess with GPT-4o\n`);

    let processed = 0;
    let failed = 0;

    for (const msg of messagesToProcess.rows) {
      try {
        console.log(`Processing: "${msg.message_text.substring(0, 50)}..."`);
        
        // Process through the pattern learning service with GPT-4o
        const result = await patternLearningService.processMessage(
          msg.message_text,
          msg.phone_number,
          msg.conversation_id,
          msg.customer_name
        );

        if (result.action === 'suggest' || result.action === 'queue') {
          // Insert the properly generated suggestion
          await db.query(`
            INSERT INTO pattern_suggestions_queue 
            (conversation_id, approved_pattern_id, pattern_type, trigger_text, 
             suggested_response, confidence_score, reasoning, phone_number, 
             status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
            ON CONFLICT DO NOTHING
          `, [
            msg.conversation_id,
            result.patternId || null,
            result.pattern?.pattern_type || 'general',
            msg.message_text,
            result.response || 'Unable to generate response',
            result.confidence || 0.7,
            JSON.stringify(result.reasoning || {
              thought_process: 'Processed with pattern learning system',
              next_steps: ['Review and approve response'],
              confidence_explanation: 'Reprocessed with current AI model'
            }),
            msg.phone_number
          ]);
          
          processed++;
          console.log(`✅ Created proper suggestion with GPT-4o response`);
        } else {
          console.log(`⏭️  Low confidence (${result.action}), skipping`);
        }
      } catch (err) {
        failed++;
        console.error(`❌ Failed to process:`, err.message);
      }
    }

    console.log(`\n✨ Reprocessing complete!`);
    console.log(`   Processed: ${processed} messages with GPT-4o`);
    console.log(`   Failed: ${failed}`);
    console.log(`\n📱 Check the V3-PLS page - suggestions should now have proper AI-generated responses`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();