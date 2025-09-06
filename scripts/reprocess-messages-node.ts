#!/usr/bin/env npx tsx
/**
 * V3-PLS Message Reprocessing Script
 * 
 * This script:
 * 1. Cleans out old/incorrect patterns
 * 2. Extracts Q&A pairs from existing OpenPhone conversations
 * 3. Reprocesses them through the pattern learning service
 * 4. Creates proper patterns with full context
 * 
 * Run with: npx tsx scripts/reprocess-messages-node.ts
 */

import { db } from '../ClubOSV1-backend/src/utils/database';
import { patternLearningService } from '../ClubOSV1-backend/src/services/patternLearningService';
import { logger } from '../ClubOSV1-backend/src/utils/logger';
import { config } from 'dotenv';

config(); // Load environment variables

interface Message {
  id?: string;
  text?: string;
  body?: string;
  direction: 'inbound' | 'outbound';
  from?: string;
  to?: string;
  createdAt?: string;
  timestamp?: string;
}

interface QAPair {
  conversationId: string;
  phoneNumber: string;
  customerName?: string;
  customerMessage: string;
  operatorResponse: string;
  timestamp: Date;
}

async function cleanOldPatterns(): Promise<void> {
  console.log('\n🧹 Step 1: Cleaning old/incorrect patterns...');
  
  try {
    // Backup existing patterns first
    await db.query(`
      CREATE TABLE IF NOT EXISTS decision_patterns_backup_${Date.now()} AS 
      SELECT * FROM decision_patterns
    `);
    
    // Delete patterns that were created with poor context
    const result = await db.query(`
      DELETE FROM decision_patterns 
      WHERE 
        confidence_score <= 0.50  -- Stuck at default
        AND execution_count = 0   -- Never used
        AND created_at < NOW()    -- Old patterns
      RETURNING id, trigger_text
    `);
    
    console.log(`✅ Deleted ${result.rows.length} old/unused patterns`);
    
    // Clear execution history for fresh start
    await db.query('TRUNCATE TABLE pattern_execution_history CASCADE');
    await db.query('TRUNCATE TABLE pattern_suggestions_queue CASCADE');
    
    console.log('✅ Cleared execution history and suggestions queue');
  } catch (error) {
    console.error('❌ Error cleaning patterns:', error);
  }
}

async function extractQAPairs(): Promise<QAPair[]> {
  console.log('\n🔍 Step 2: Extracting Q&A pairs from conversations...');
  
  try {
    // Get all conversations with messages
    const conversations = await db.query(`
      SELECT 
        id,
        conversation_id,
        phone_number,
        customer_name,
        messages,
        created_at
      FROM openphone_conversations
      WHERE 
        messages IS NOT NULL 
        AND jsonb_array_length(messages) > 0
      ORDER BY created_at DESC
      LIMIT 1000  -- Process most recent 1000 conversations
    `);
    
    console.log(`Found ${conversations.rows.length} conversations to process`);
    
    const qaPairs: QAPair[] = [];
    
    for (const conv of conversations.rows) {
      const messages = conv.messages as Message[];
      
      if (!Array.isArray(messages)) continue;
      
      // Sort messages by timestamp
      const sortedMessages = messages.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
        const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
        return timeA - timeB;
      });
      
      // Find Q&A pairs (inbound followed by outbound)
      for (let i = 0; i < sortedMessages.length - 1; i++) {
        const currentMsg = sortedMessages[i];
        const nextMsg = sortedMessages[i + 1];
        
        // Get message text (different formats in the data)
        const currentText = currentMsg.text || currentMsg.body || '';
        const nextText = nextMsg.text || nextMsg.body || '';
        
        // Look for customer question followed by operator response
        if (currentMsg.direction === 'inbound' && 
            nextMsg.direction === 'outbound' &&
            currentText.length > 10 && 
            nextText.length > 10) {
          
          qaPairs.push({
            conversationId: conv.conversation_id || conv.id,
            phoneNumber: conv.phone_number,
            customerName: conv.customer_name,
            customerMessage: currentText,
            operatorResponse: nextText,
            timestamp: new Date(nextMsg.createdAt || nextMsg.timestamp || conv.created_at)
          });
        }
      }
    }
    
    console.log(`✅ Extracted ${qaPairs.length} Q&A pairs`);
    
    // Show sample
    if (qaPairs.length > 0) {
      console.log('\n📋 Sample Q&A pairs:');
      qaPairs.slice(0, 3).forEach((qa, idx) => {
        console.log(`\n${idx + 1}. Customer: "${qa.customerMessage.substring(0, 60)}..."`);
        console.log(`   Operator: "${qa.operatorResponse.substring(0, 60)}..."`);
      });
    }
    
    return qaPairs;
  } catch (error) {
    console.error('❌ Error extracting Q&A pairs:', error);
    return [];
  }
}

async function reprocessMessages(qaPairs: QAPair[]): Promise<void> {
  console.log('\n🤖 Step 3: Reprocessing messages through pattern learning...');
  
  if (qaPairs.length === 0) {
    console.log('No Q&A pairs to process');
    return;
  }
  
  // Group similar Q&A pairs to avoid duplicates
  const uniquePatterns = new Map<string, QAPair[]>();
  
  for (const qa of qaPairs) {
    // Create a simple key from the first 30 chars of the question
    const key = qa.customerMessage.toLowerCase().substring(0, 30).replace(/[^a-z0-9]/g, '');
    
    if (!uniquePatterns.has(key)) {
      uniquePatterns.set(key, []);
    }
    uniquePatterns.get(key)!.push(qa);
  }
  
  console.log(`\n🔄 Processing ${uniquePatterns.size} unique pattern types...`);
  
  let processed = 0;
  let created = 0;
  
  for (const [key, qas] of uniquePatterns) {
    // Use the most recent Q&A pair as the canonical example
    const bestQA = qas.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    
    try {
      // Call the pattern learning service
      await patternLearningService.learnFromHumanResponse(
        bestQA.customerMessage,
        bestQA.operatorResponse,
        [], // No actions for historical data
        bestQA.conversationId,
        bestQA.phoneNumber,
        'system' // System user for reprocessing
      );
      
      created++;
      processed++;
      
      // Show progress
      if (processed % 10 === 0) {
        console.log(`  Processed ${processed}/${uniquePatterns.size} patterns...`);
      }
    } catch (error) {
      console.error(`  ⚠️ Error processing pattern: ${error.message}`);
      processed++;
    }
  }
  
  console.log(`\n✅ Reprocessing complete!`);
  console.log(`   - Processed: ${processed} unique patterns`);
  console.log(`   - Created: ${created} new patterns`);
}

async function updatePatternMetadata(): Promise<void> {
  console.log('\n🏷️ Step 4: Updating pattern metadata for UI...');
  
  try {
    // Add automation card info to patterns without it
    await db.query(`
      UPDATE decision_patterns
      SET 
        automation_name = CASE 
          WHEN trigger_text ILIKE '%gift%card%' THEN 'Gift Card Inquiries'
          WHEN trigger_text ILIKE '%hour%' THEN 'Hours & Location Info'
          WHEN trigger_text ILIKE '%book%' THEN 'Booking Assistance'
          WHEN trigger_text ILIKE '%price%' OR trigger_text ILIKE '%cost%' THEN 'Pricing Information'
          WHEN trigger_text ILIKE '%member%' THEN 'Membership Questions'
          WHEN trigger_text ILIKE '%track%man%' THEN 'Trackman Support'
          WHEN trigger_text ILIKE '%door%' OR trigger_text ILIKE '%access%' THEN 'Access Issues'
          ELSE CONCAT('Auto Response: ', LEFT(trigger_text, 30))
        END,
        automation_description = CONCAT('Responds to: "', LEFT(trigger_text, 60), '..."'),
        automation_icon = CASE 
          WHEN trigger_text ILIKE '%gift%card%' THEN '🎁'
          WHEN trigger_text ILIKE '%hour%' THEN '🕐'
          WHEN trigger_text ILIKE '%book%' THEN '📅'
          WHEN trigger_text ILIKE '%price%' OR trigger_text ILIKE '%cost%' THEN '💰'
          WHEN trigger_text ILIKE '%member%' THEN '💳'
          WHEN trigger_text ILIKE '%track%man%' THEN '🔧'
          WHEN trigger_text ILIKE '%door%' OR trigger_text ILIKE '%access%' THEN '🚪'
          ELSE '💬'
        END,
        automation_category = CASE 
          WHEN trigger_text ILIKE '%track%man%' OR trigger_text ILIKE '%door%' THEN 'technical'
          ELSE 'customer_service'
        END
      WHERE automation_name IS NULL
    `);
    
    console.log('✅ Updated pattern metadata');
  } catch (error) {
    console.error('❌ Error updating metadata:', error);
  }
}

async function showFinalStats(): Promise<void> {
  console.log('\n📊 Final Statistics:');
  
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_patterns,
        COUNT(*) FILTER (WHERE is_active = true) as active_patterns,
        COUNT(*) FILTER (WHERE confidence_score >= 0.70) as confident_patterns,
        AVG(confidence_score) as avg_confidence
      FROM decision_patterns
    `);
    
    const topPatterns = await db.query(`
      SELECT 
        automation_name,
        trigger_text,
        confidence_score,
        is_active
      FROM decision_patterns
      ORDER BY confidence_score DESC
      LIMIT 5
    `);
    
    console.log('\n📈 Pattern Statistics:');
    console.log(`   Total patterns: ${stats.rows[0].total_patterns}`);
    console.log(`   Active patterns: ${stats.rows[0].active_patterns}`);
    console.log(`   High confidence: ${stats.rows[0].confident_patterns}`);
    console.log(`   Avg confidence: ${(stats.rows[0].avg_confidence * 100).toFixed(1)}%`);
    
    if (topPatterns.rows.length > 0) {
      console.log('\n🏆 Top Patterns:');
      topPatterns.rows.forEach((p, idx) => {
        const status = p.is_active ? '✅' : '⭕';
        console.log(`   ${idx + 1}. ${status} ${p.automation_name || p.trigger_text.substring(0, 30)} (${(p.confidence_score * 100).toFixed(0)}%)`);
      });
    }
  } catch (error) {
    console.error('❌ Error getting stats:', error);
  }
}

async function main() {
  console.log('===========================================');
  console.log('    V3-PLS Message Reprocessing Script    ');
  console.log('===========================================');
  
  try {
    // Step 1: Clean old patterns
    await cleanOldPatterns();
    
    // Step 2: Extract Q&A pairs
    const qaPairs = await extractQAPairs();
    
    // Step 3: Reprocess through pattern learning
    await reprocessMessages(qaPairs);
    
    // Step 4: Update metadata
    await updatePatternMetadata();
    
    // Step 5: Show stats
    await showFinalStats();
    
    console.log('\n✨ Reprocessing complete! Check the V3-PLS page to review patterns.');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  } finally {
    // Close database connection
    await db.end();
    process.exit(0);
  }
}

// Run the script
main().catch(console.error);