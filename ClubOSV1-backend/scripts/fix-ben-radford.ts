#!/usr/bin/env npx tsx

/**
 * Quick fix for Ben Radford's conversation timestamp issue
 */

import { Client } from 'pg';

async function fixBenRadford() {
  const client = new Client({
    connectionString: 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway'
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Find Ben Radford's conversation
    const result = await client.query(`
      SELECT id, phone_number, customer_name, messages, created_at, updated_at
      FROM openphone_conversations
      WHERE customer_name ILIKE '%radford%' OR customer_name ILIKE '%ben%'
      ORDER BY updated_at DESC
      LIMIT 5
    `);

    console.log(`Found ${result.rows.length} potential matches`);

    for (const conv of result.rows) {
      console.log(`\nConversation: ${conv.customer_name || conv.phone_number}`);
      console.log(`  Current updated_at: ${conv.updated_at}`);
      
      // Parse messages to find the most recent one
      const messages = conv.messages || [];
      if (messages.length > 0) {
        let latestTimestamp = null;
        
        for (const msg of messages) {
          const msgTime = msg.createdAt || msg.timestamp || msg.created_at;
          if (msgTime) {
            const msgDate = new Date(msgTime);
            if (!latestTimestamp || msgDate > latestTimestamp) {
              latestTimestamp = msgDate;
            }
          }
        }
        
        if (latestTimestamp) {
          console.log(`  Latest message: ${latestTimestamp.toISOString()}`);
          
          const currentUpdatedAt = new Date(conv.updated_at);
          const timeDiff = currentUpdatedAt.getTime() - latestTimestamp.getTime();
          const daysDiff = Math.round(timeDiff / 86400000);
          
          if (daysDiff > 1) {
            console.log(`  ⚠️ Updated_at is ${daysDiff} days ahead of last message`);
            console.log(`  Fixing timestamp...`);
            
            await client.query(`
              UPDATE openphone_conversations
              SET updated_at = $1
              WHERE id = $2
            `, [latestTimestamp, conv.id]);
            
            console.log(`  ✅ Fixed!`);
          }
        }
      }
    }

    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

fixBenRadford();