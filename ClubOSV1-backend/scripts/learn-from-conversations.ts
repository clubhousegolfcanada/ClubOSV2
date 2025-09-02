#!/usr/bin/env tsx
/**
 * Learn Patterns from Real OpenPhone Conversations
 * Creates high-quality patterns with GPT-4 analysis
 */

import { Pool } from 'pg';
import OpenAI from 'openai';
import crypto from 'crypto';

const EXTERNAL_DB = 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway';

const db = new Pool({
  connectionString: EXTERNAL_DB,
  ssl: { rejectUnauthorized: false }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY required. Run with: railway run npx tsx scripts/learn-from-conversations.ts');
  process.exit(1);
}

async function learnFromConversations() {
  try {
    console.log('Learning patterns from real conversations...\n');
    
    // Get conversations with actual back-and-forth
    const conversations = await db.query(`
      SELECT id, phone_number, customer_name, messages
      FROM openphone_conversations
      WHERE jsonb_array_length(messages) > 2
        AND created_at > NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC
      LIMIT 50
    `);
    
    console.log(`Processing ${conversations.rows.length} conversations...\n`);
    
    let patternsCreated = 0;
    let patternsSkipped = 0;
    
    for (const conv of conversations.rows) {
      const messages = conv.messages || [];
      
      // Find inbound->outbound pairs
      for (let i = 0; i < messages.length - 1; i++) {
        const inMsg = messages[i];
        const outMsg = messages[i + 1];
        
        // Look for customer->operator pattern
        if (inMsg.direction === 'inbound' && outMsg.direction === 'outbound') {
          const customerText = inMsg.text || inMsg.body || '';
          const operatorText = outMsg.text || outMsg.body || '';
          
          // Skip automated responses
          if (operatorText.includes('[Automated]') || operatorText.includes('🤖')) {
            continue;
          }
          
          // Skip very short exchanges
          if (customerText.length < 20 || operatorText.length < 20) {
            continue;
          }
          
          try {
            // Use GPT-4 to create a high-quality pattern
            const analysis = await openai.chat.completions.create({
              model: 'gpt-4-turbo-preview',
              messages: [{
                role: 'system',
                content: `Analyze this real customer service conversation and create a reusable pattern.
                
                Return JSON with:
                - pattern_type: one of [booking, tech_issue, access, faq, gift_cards, hours, general]
                - intent: what the customer wants (e.g., "reset_simulator", "check_availability")
                - entities: extracted values as key-value pairs
                - keywords: 3-5 important keywords for matching
                - response_template: generalized response using {{variables}} for dynamic parts
                  Variables to use: {{customer_name}}, {{bay_number}}, {{time}}, {{date}}, {{location}}
                - confidence: 0.70 (since this is from real conversation)
                - is_useful: boolean - is this pattern useful for automation?
                - summary: one-line description
                
                Make the response_template professional and helpful.`
              }, {
                role: 'user',
                content: `Customer: "${customerText}"\nOperator: "${operatorText}"`
              }],
              temperature: 0.3,
              response_format: { type: "json_object" }
            });
            
            const pattern = JSON.parse(analysis.choices[0].message.content || '{}');
            
            // Skip if not useful
            if (!pattern.is_useful) {
              patternsSkipped++;
              continue;
            }
            
            // Generate signature
            const signature = crypto.createHash('md5')
              .update(customerText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim())
              .digest('hex');
            
            // Store the pattern
            await db.query(`
              INSERT INTO decision_patterns (
                pattern_type, pattern_signature, trigger_text, trigger_keywords,
                response_template, action_template, confidence_score,
                created_from, notes, is_active
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
              ON CONFLICT (pattern_signature) DO UPDATE
              SET response_template = EXCLUDED.response_template,
                  confidence_score = GREATEST(decision_patterns.confidence_score, EXCLUDED.confidence_score),
                  last_modified = NOW()
            `, [
              pattern.pattern_type || 'general',
              signature,
              customerText.substring(0, 500),
              pattern.keywords || [],
              pattern.response_template,
              JSON.stringify({
                intent: pattern.intent,
                entities: pattern.entities || {}
              }),
              pattern.confidence || 0.70,
              'conversation_learning',
              pattern.summary || 'Learned from real conversation'
            ]);
            
            patternsCreated++;
            process.stdout.write(`\rCreated ${patternsCreated} patterns, skipped ${patternsSkipped}...`);
            
            // Rate limit
            await new Promise(r => setTimeout(r, 1000));
            
          } catch (error: any) {
            console.error(`\nError processing conversation: ${error.message}`);
          }
        }
      }
    }
    
    console.log('\n\n✅ Learning complete!\n');
    
    // Show results
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN response_template LIKE '%{{%' THEN 1 END) as templated,
        AVG(confidence_score) as avg_confidence
      FROM decision_patterns
      WHERE created_from = 'conversation_learning'
    `);
    
    console.log('Pattern Statistics:');
    console.log(`  Total patterns: ${stats.rows[0].total}`);
    console.log(`  With templates: ${stats.rows[0].templated}`);
    console.log(`  Avg confidence: ${parseFloat(stats.rows[0].avg_confidence || 0).toFixed(2)}`);
    
    // Show sample patterns
    const samples = await db.query(`
      SELECT pattern_type, trigger_keywords, response_template
      FROM decision_patterns
      WHERE created_from = 'conversation_learning'
        AND response_template LIKE '%{{%'
      LIMIT 3
    `);
    
    if (samples.rows.length > 0) {
      console.log('\nSample learned patterns:');
      samples.rows.forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.pattern_type}:`);
        console.log(`   Keywords: ${p.trigger_keywords.join(', ')}`);
        console.log(`   Template: "${p.response_template}"`);
      });
    }
    
  } catch (error: any) {
    console.error('Failed:', error.message);
  } finally {
    await db.end();
  }
}

learnFromConversations();