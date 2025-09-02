#!/usr/bin/env tsx
/**
 * Backfill Pattern Learning from Existing Conversations
 * 
 * This script processes existing OpenPhone conversations to learn patterns
 * from operator responses that were sent directly through OpenPhone
 */

import { Pool } from 'pg';
import { logger } from '../src/utils/logger';
import { patternLearningService } from '../src/services/patternLearningService';

// Use external database URL for scripts
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway',
  ssl: { rejectUnauthorized: false }
});

async function backfillPatterns() {
  try {
    logger.info('Starting pattern learning backfill...');
    
    // Get all conversations from the last 30 days
    const conversations = await db.query(`
      SELECT id, phone_number, customer_name, messages, created_at
      FROM openphone_conversations
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND jsonb_array_length(messages) > 1
      ORDER BY created_at DESC
    `);
    
    logger.info(`Found ${conversations.rows.length} conversations to process`);
    
    let patternsLearned = 0;
    let conversationsProcessed = 0;
    
    for (const conv of conversations.rows) {
      try {
        const messages = conv.messages || [];
        
        // Find pairs of inbound messages followed by outbound responses
        for (let i = 0; i < messages.length - 1; i++) {
          const currentMsg = messages[i];
          const nextMsg = messages[i + 1];
          
          // Look for inbound->outbound pattern
          if (currentMsg.direction === 'inbound' && nextMsg.direction === 'outbound') {
            const customerMessage = currentMsg.text || currentMsg.body || '';
            const operatorResponse = nextMsg.text || nextMsg.body || '';
            
            // Skip if the response looks automated
            if (operatorResponse.includes('[Automated Response]') || 
                operatorResponse.includes('🤖')) {
              continue;
            }
            
            // Skip very short exchanges
            if (customerMessage.length < 10 || operatorResponse.length < 10) {
              continue;
            }
            
            // Learn from this pattern
            await patternLearningService.learnFromHumanResponse(
              customerMessage,
              operatorResponse,
              [], // No actions to extract from historical data
              conv.id,
              conv.phone_number,
              undefined // No operator ID available
            );
            
            patternsLearned++;
            
            logger.debug(`Learned pattern from conversation ${conv.id}`, {
              customerMsg: customerMessage.substring(0, 50),
              operatorResponse: operatorResponse.substring(0, 50)
            });
          }
        }
        
        conversationsProcessed++;
        
        if (conversationsProcessed % 10 === 0) {
          logger.info(`Progress: ${conversationsProcessed}/${conversations.rows.length} conversations processed, ${patternsLearned} patterns learned`);
        }
      } catch (error) {
        logger.error(`Failed to process conversation ${conv.id}:`, error);
      }
    }
    
    // Get summary of learned patterns
    const patternSummary = await db.query(`
      SELECT 
        pattern_type,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence,
        MAX(confidence_score) as max_confidence
      FROM decision_patterns
      GROUP BY pattern_type
      ORDER BY count DESC
    `);
    
    logger.info('=== BACKFILL COMPLETE ===');
    logger.info(`Conversations processed: ${conversationsProcessed}`);
    logger.info(`Patterns learned: ${patternsLearned}`);
    logger.info('Pattern summary:', patternSummary.rows);
    
    // Mark conversations as processed
    await db.query(`
      UPDATE openphone_conversations
      SET processed = true
      WHERE created_at > NOW() - INTERVAL '30 days'
    `);
    
    logger.info('Marked conversations as processed');
    
  } catch (error) {
    logger.error('Backfill failed:', error);
    process.exit(1);
  } finally {
    await db.end();
    process.exit(0);
  }
}

// Run the backfill
backfillPatterns();