#!/usr/bin/env tsx
/**
 * Import Historical Patterns from OpenPhone Conversations
 * 
 * This script analyzes existing conversations to build initial patterns
 * Run with: railway run tsx scripts/import-historical-patterns.ts
 */

import { db } from '../src/utils/database';
import { logger } from '../src/utils/logger';
import { patternLearningService } from '../src/services/patternLearningService';
import { conversationAnalyzer } from '../src/services/conversationAnalyzer';

interface ImportOptions {
  limit?: number;
  daysBack?: number;
  phoneFilter?: string;
  dryRun?: boolean;
}

async function importHistoricalPatterns(options: ImportOptions = {}) {
  const {
    limit = 100,
    daysBack = 30,
    phoneFilter,
    dryRun = false
  } = options;
  
  try {
    logger.info('Starting historical pattern import', {
      limit,
      daysBack,
      phoneFilter,
      dryRun
    });
    
    // Initialize database
    await db.initialize();
    
    // Get conversations from the last N days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    // Fetch conversations with messages
    const conversations = await db.query(`
      SELECT 
        c.id,
        c.conversation_id,
        c.phone_number,
        c.customer_name,
        c.messages,
        c.created_at,
        c.updated_at,
        COUNT(DISTINCT DATE(c.created_at)) as conversation_days
      FROM openphone_conversations c
      WHERE c.created_at >= $1
        ${phoneFilter ? 'AND c.phone_number = $2' : ''}
        AND c.messages IS NOT NULL
        AND jsonb_array_length(c.messages) > 1
      GROUP BY c.id
      ORDER BY c.updated_at DESC
      LIMIT $${phoneFilter ? 3 : 2}
    `, phoneFilter ? [startDate, phoneFilter, limit] : [startDate, limit]);
    
    logger.info(`Found ${conversations.rows.length} conversations to analyze`);
    
    let patternsCreated = 0;
    let patternsUpdated = 0;
    let errors = 0;
    
    for (const conv of conversations.rows) {
      try {
        const messages = conv.messages || [];
        
        if (messages.length < 2) {
          continue; // Skip single-message conversations
        }
        
        // Extract conversation context
        const context = await conversationAnalyzer.extractConversationContext(messages);
        
        logger.info(`Analyzing conversation ${conv.conversation_id}`, {
          messageCount: messages.length,
          category: context.category,
          intent: context.intent,
          isComplete: context.isComplete
        });
        
        // Find customer-operator message pairs
        for (let i = 0; i < messages.length - 1; i++) {
          const currentMsg = messages[i];
          const nextMsg = messages[i + 1];
          
          // Look for customer message followed by operator response
          if (currentMsg.direction === 'inbound' && nextMsg.direction === 'outbound') {
            const customerMessage = currentMsg.body || currentMsg.text;
            const operatorResponse = nextMsg.body || nextMsg.text;
            
            if (!customerMessage || !operatorResponse) continue;
            
            // Skip very short exchanges
            if (customerMessage.length < 10 || operatorResponse.length < 10) continue;
            
            // Extract actions from the response
            const actions = extractActionsFromResponse(operatorResponse, messages.slice(i + 2));
            
            if (!dryRun) {
              // Learn from this interaction
              await patternLearningService.learnFromHumanResponse(
                customerMessage,
                operatorResponse,
                actions,
                conv.conversation_id,
                conv.phone_number,
                'historical_import'
              );
              
              patternsCreated++;
            } else {
              logger.info('[DRY RUN] Would learn pattern', {
                customer: customerMessage.substring(0, 50),
                operator: operatorResponse.substring(0, 50),
                category: context.category
              });
            }
          }
        }
        
        // Also look for common FAQ patterns
        if (context.category === 'faq' || context.intent === 'inquiry') {
          await extractFAQPatterns(messages, conv, dryRun);
        }
        
      } catch (error) {
        logger.error(`Error processing conversation ${conv.id}:`, error);
        errors++;
      }
    }
    
    // Analyze and consolidate patterns
    if (!dryRun) {
      await consolidateSimilarPatterns();
    }
    
    // Generate summary
    const summary = await db.query(`
      SELECT 
        COUNT(*) as total_patterns,
        COUNT(DISTINCT pattern_type) as unique_types,
        AVG(confidence_score) as avg_confidence,
        COUNT(CASE WHEN confidence_score > 0.8 THEN 1 END) as high_confidence
      FROM decision_patterns
      WHERE created_from = 'learned'
    `);
    
    logger.info('Import completed!', {
      conversationsProcessed: conversations.rows.length,
      patternsCreated,
      patternsUpdated,
      errors,
      summary: summary.rows[0]
    });
    
    // Provide recommendations
    logger.info('Recommendations:');
    logger.info('1. Review patterns in V3-PLS tab');
    logger.info('2. Start with shadow mode enabled');
    logger.info('3. Manually approve high-confidence patterns');
    logger.info('4. Monitor for 1 week before enabling auto-execution');
    
  } catch (error) {
    logger.error('Import failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

/**
 * Extract actions from operator response and subsequent messages
 */
function extractActionsFromResponse(response: string, subsequentMessages: any[]): any[] {
  const actions = [];
  
  // Check for ticket creation mentions
  if (response.match(/ticket|created a ticket|logged this|reported/i)) {
    actions.push({ type: 'create_ticket' });
  }
  
  // Check for scheduling
  if (response.match(/booked|scheduled|reserved|confirmation/i)) {
    actions.push({ type: 'create_booking' });
  }
  
  // Check for information sending
  if (response.match(/sent|emailed|texted|forwarded/i)) {
    actions.push({ type: 'send_information' });
  }
  
  // Check for door/access actions
  if (response.match(/unlocked|opened|reset.*code|access/i)) {
    actions.push({ type: 'grant_access' });
  }
  
  // Check for refund/credit
  if (response.match(/refund|credit|reimburse/i)) {
    actions.push({ type: 'process_refund' });
  }
  
  return actions;
}

/**
 * Extract FAQ patterns from conversations
 */
async function extractFAQPatterns(messages: any[], conv: any, dryRun: boolean) {
  // Look for common questions and their answers
  const faqPatterns = [
    { pattern: /hours|open|close/i, category: 'hours' },
    { pattern: /price|cost|rate/i, category: 'pricing' },
    { pattern: /location|address|where/i, category: 'location' },
    { pattern: /gift.*card/i, category: 'gift_cards' },
    { pattern: /member|pass/i, category: 'membership' }
  ];
  
  for (const msg of messages) {
    if (msg.direction !== 'inbound') continue;
    
    const text = msg.body || msg.text || '';
    
    for (const faq of faqPatterns) {
      if (faq.pattern.test(text)) {
        // Find the operator's response
        const responseIndex = messages.findIndex(m => 
          m === msg
        ) + 1;
        
        if (responseIndex < messages.length && 
            messages[responseIndex].direction === 'outbound') {
          const response = messages[responseIndex].body || messages[responseIndex].text;
          
          if (!dryRun) {
            // Create FAQ pattern
            await db.query(`
              INSERT INTO decision_patterns 
              (pattern_type, pattern_signature, trigger_text, 
               response_template, confidence_score, category, created_from)
              VALUES ($1, $2, $3, $4, $5, $6, 'historical_import')
              ON CONFLICT (pattern_signature) DO UPDATE
              SET execution_count = decision_patterns.execution_count + 1
            `, [
              'faq',
              require('crypto').createHash('md5').update(text.toLowerCase()).digest('hex'),
              text,
              response,
              0.6, // Start with moderate confidence for FAQs
              faq.category
            ]);
          }
        }
      }
    }
  }
}

/**
 * Consolidate similar patterns to avoid duplicates
 */
async function consolidateSimilarPatterns() {
  logger.info('Consolidating similar patterns...');
  
  // Find patterns with similar signatures or text
  const result = await db.query(`
    WITH pattern_groups AS (
      SELECT 
        pattern_type,
        category,
        COUNT(*) as occurrence_count,
        MAX(confidence_score) as max_confidence,
        ARRAY_AGG(id) as pattern_ids,
        ARRAY_AGG(trigger_text) as triggers
      FROM decision_patterns
      WHERE created_from = 'learned'
      GROUP BY pattern_type, category, LEFT(pattern_signature, 8)
      HAVING COUNT(*) > 1
    )
    UPDATE decision_patterns p
    SET confidence_score = pg.max_confidence + 0.05,
        execution_count = pg.occurrence_count
    FROM pattern_groups pg
    WHERE p.id = ANY(pg.pattern_ids)
    RETURNING p.id
  `);
  
  logger.info(`Consolidated ${result.rows.length} similar patterns`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: ImportOptions = {
  limit: parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '100'),
  daysBack: parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1] || '30'),
  phoneFilter: args.find(a => a.startsWith('--phone='))?.split('=')[1],
  dryRun: args.includes('--dry-run')
};

// Run the import
importHistoricalPatterns(options)
  .then(() => {
    logger.info('Historical import completed successfully');
    process.exit(0);
  })
  .catch(error => {
    logger.error('Historical import failed:', error);
    process.exit(1);
  });