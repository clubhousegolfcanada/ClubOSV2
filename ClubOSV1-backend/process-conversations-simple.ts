/**
 * Simple conversation processor - direct database connection
 */

import { Pool } from 'pg';
import OpenAI from 'openai';

const pool = new Pool({
  connectionString: "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway"
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function processConversations() {
  console.log('🔄 Processing Conversations for Knowledge\n');
  console.log('=' .repeat(50) + '\n');
  
  try {
    // Check how many conversations we have
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM openphone_conversations WHERE processed = false OR processed IS NULL) as openphone_unprocessed,
        (SELECT COUNT(*) FROM conversation_sessions) as sessions_total,
        (SELECT COUNT(*) FROM knowledge_store WHERE source_type IN ('conversation', 'openphone_conversation')) as existing_conv_knowledge
    `);
    
    console.log('📊 Current Status:');
    console.log(`  OpenPhone unprocessed: ${stats.rows[0].openphone_unprocessed}`);
    console.log(`  Conversation sessions: ${stats.rows[0].sessions_total}`);
    console.log(`  Existing conversation knowledge: ${stats.rows[0].existing_conv_knowledge}\n`);
    
    // Process a few OpenPhone conversations as a test
    const conversations = await pool.query(`
      SELECT * FROM openphone_conversations 
      WHERE (processed = false OR processed IS NULL)
      AND messages IS NOT NULL
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log(`\nProcessing ${conversations.rows.length} conversations...\n`);
    
    let knowledgeAdded = 0;
    
    for (const conv of conversations.rows) {
      const messages = conv.messages || [];
      if (messages.length < 3) continue;
      
      // Format conversation
      const text = messages.slice(0, 10).map((m: any) => 
        `${m.direction === 'inbound' ? 'Customer' : 'Support'}: ${m.body || m.text}`
      ).join('\n');
      
      console.log(`Processing conversation ${conv.conversation_id}...`);
      
      // Extract knowledge
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Extract only the most valuable, reusable knowledge from this conversation. Focus on facts about services, policies, and solutions.'
          },
          {
            role: 'user',
            content: `Extract knowledge from:\n${text}\n\nReturn as JSON: {"knowledge": [{"category": "...", "question": "...", "answer": "...", "confidence": 0.0-1.0}]}`
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });
      
      const result = JSON.parse(response.choices[0].message.content || '{"knowledge": []}');
      
      // Add valuable knowledge
      for (const item of result.knowledge || []) {
        if (item.confidence >= 0.7) {
          const key = `conv.${item.category}.${conv.id}.${Date.now()}`;
          
          await pool.query(`
            INSERT INTO knowledge_store (key, value, confidence, category, source_type, source_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (key) DO NOTHING
          `, [
            key,
            JSON.stringify({
              question: item.question,
              answer: item.answer,
              content: item.answer
            }),
            item.confidence * 0.8,
            item.category || 'general',
            'openphone_conversation',
            conv.id
          ]);
          
          knowledgeAdded++;
        }
      }
      
      // Mark as processed
      await pool.query('UPDATE openphone_conversations SET processed = true WHERE id = $1', [conv.id]);
    }
    
    console.log(`\n✅ Added ${knowledgeAdded} knowledge items\n`);
    
    // Final count
    const final = await pool.query('SELECT COUNT(*) FROM knowledge_store');
    console.log(`📚 Total knowledge items: ${final.rows[0].count}\n`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

processConversations();