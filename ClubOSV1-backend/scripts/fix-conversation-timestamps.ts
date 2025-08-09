#!/usr/bin/env npx tsx

/**
 * Fix conversation timestamps to use the first message timestamp
 * This resolves the issue where all conversations appear to have the same time
 */

import { pool } from '../src/utils/db';
import { logger } from '../src/utils/logger';

async function fixConversationTimestamps() {
  console.log('=== Fixing Conversation Timestamps ===\n');
  
  try {
    // Get all conversations
    const conversations = await pool.query(`
      SELECT id, phone_number, messages, created_at, updated_at
      FROM openphone_conversations
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${conversations.rows.length} conversations to check\n`);
    
    let fixed = 0;
    let errors = 0;
    
    for (const conv of conversations.rows) {
      try {
        const messages = conv.messages || [];
        
        if (messages.length === 0) {
          console.log(`Skipping conversation ${conv.id} - no messages`);
          continue;
        }
        
        // Find the earliest message timestamp
        let earliestTimestamp = null;
        let latestTimestamp = null;
        
        for (const msg of messages) {
          // Try different timestamp fields that might exist
          const msgTime = msg.timestamp || msg.createdAt || msg.created_at || msg.date;
          
          if (msgTime) {
            const msgDate = new Date(msgTime);
            
            if (!earliestTimestamp || msgDate < earliestTimestamp) {
              earliestTimestamp = msgDate;
            }
            
            if (!latestTimestamp || msgDate > latestTimestamp) {
              latestTimestamp = msgDate;
            }
          }
        }
        
        if (!earliestTimestamp) {
          console.log(`Warning: No valid timestamps found in messages for conversation ${conv.id}`);
          continue;
        }
        
        // Check if the conversation timestamps need updating
        const currentCreatedAt = new Date(conv.created_at);
        const currentUpdatedAt = new Date(conv.updated_at);
        
        // Only update if the difference is significant (more than 1 minute)
        const createdDiff = Math.abs(currentCreatedAt.getTime() - earliestTimestamp.getTime());
        const updatedDiff = Math.abs(currentUpdatedAt.getTime() - latestTimestamp.getTime());
        
        if (createdDiff > 60000 || updatedDiff > 60000) {
          console.log(`Updating conversation ${conv.phone_number}:`);
          console.log(`  Old created_at: ${currentCreatedAt.toISOString()}`);
          console.log(`  New created_at: ${earliestTimestamp.toISOString()}`);
          console.log(`  Old updated_at: ${currentUpdatedAt.toISOString()}`);
          console.log(`  New updated_at: ${latestTimestamp.toISOString()}\n`);
          
          await pool.query(`
            UPDATE openphone_conversations
            SET created_at = $1, updated_at = $2
            WHERE id = $3
          `, [earliestTimestamp, latestTimestamp, conv.id]);
          
          fixed++;
        }
      } catch (error) {
        console.error(`Error processing conversation ${conv.id}:`, error);
        errors++;
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total conversations: ${conversations.rows.length}`);
    console.log(`Fixed: ${fixed}`);
    console.log(`Errors: ${errors}`);
    console.log(`Unchanged: ${conversations.rows.length - fixed - errors}`);
    
    // Verify the fix
    console.log('\n=== Verifying Fix ===');
    const verification = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as conversations,
        COUNT(DISTINCT DATE_TRUNC('minute', created_at)) as unique_minutes
      FROM openphone_conversations
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 7
    `);
    
    console.log('\nConversations per day (last 7 days):');
    for (const row of verification.rows) {
      console.log(`  ${row.date}: ${row.conversations} conversations across ${row.unique_minutes} different minutes`);
    }
    
  } catch (error) {
    console.error('Failed to fix timestamps:', error);
    process.exit(1);
  }
}

// Run the fix
fixConversationTimestamps()
  .then(() => {
    console.log('\n✅ Timestamp fix complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  });