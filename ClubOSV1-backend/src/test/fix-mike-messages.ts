#!/usr/bin/env npx tsx
/**
 * Fix Mike's conversation by adding missing messages
 */

import { db } from '../utils/database';

async function fixMessages() {
  console.log('Fixing Mike\'s conversation messages...');
  
  // Get the current conversation
  const result = await db.query(
    `SELECT id, messages FROM openphone_conversations 
     WHERE phone_number = '+19024783209' 
     ORDER BY created_at DESC 
     LIMIT 1`
  );
  
  if (result.rows.length === 0) {
    console.log('No conversation found');
    process.exit(1);
  }
  
  const conv = result.rows[0];
  const currentMessages = conv.messages || [];
  console.log(`Current message count: ${currentMessages.length}`);
  console.log(`Last message: ${currentMessages[currentMessages.length - 1]?.body}`);
  
  // Add the missing messages
  const newMessages = [
    {
      id: `msg_${Date.now()}_1`,
      body: "We do have clubs at our locations but as a benefit if bringing a friend new to golf, we recommend not relying on them in case they are already in use.",
      text: "We do have clubs at our locations but as a benefit if bringing a friend new to golf, we recommend not relying on them in case they are already in use.",
      direction: "outbound",
      from: "+19024757540",
      to: "+19024783209",
      createdAt: "2025-09-06T17:20:00.000Z",
      status: "sent"
    },
    {
      id: `msg_${Date.now()}_2`,
      body: "Okay thank you.",
      text: "Okay thank you.",
      direction: "inbound",
      from: "+19024783209",
      to: "+19024757540",
      createdAt: "2025-09-06T17:21:00.000Z"
    },
    {
      id: `msg_${Date.now()}_3`,
      body: "We do have clubs at our locations but as a benefit if bringing a friend new to golf, we recommend not relying on them in case they are already in use.",
      text: "We do have clubs at our locations but as a benefit if bringing a friend new to golf, we recommend not relying on them in case they are already in use.",
      direction: "outbound",
      from: "+19024757540",
      to: "+19024783209",
      createdAt: "2025-09-06T17:22:00.000Z",
      status: "sent"
    },
    {
      id: `msg_${Date.now()}_4`,
      body: "have a great day",
      text: "have a great day",
      direction: "outbound",
      from: "+19024757540",
      to: "+19024783209",
      createdAt: "2025-09-06T17:23:00.000Z",
      status: "sent"
    }
  ];
  
  // Combine messages
  const allMessages = [...currentMessages, ...newMessages];
  
  // Update the conversation
  await db.query(
    `UPDATE openphone_conversations 
     SET messages = $1, updated_at = NOW() 
     WHERE id = $2`,
    [JSON.stringify(allMessages), conv.id]
  );
  
  console.log(`Updated conversation with ${newMessages.length} new messages`);
  console.log(`Total messages now: ${allMessages.length}`);
  
  process.exit(0);
}

fixMessages().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});