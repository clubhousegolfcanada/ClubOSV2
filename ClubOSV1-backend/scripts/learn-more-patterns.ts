#!/usr/bin/env tsx
/**
 * Continue Learning Patterns from Remaining Conversations
 */

import { Pool } from 'pg';
import OpenAI from 'openai';
import crypto from 'crypto';

const db = new Pool({
  connectionString: 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway',
  ssl: { rejectUnauthorized: false }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

if (!process.env.OPENAI_API_KEY) {
  console.error('Run with: railway run npx tsx scripts/learn-more-patterns.ts');
  process.exit(1);
}

async function learnMorePatterns() {
  try {
    // Get patterns we already have to avoid duplicates
    const existing = await db.query(`
      SELECT pattern_signature FROM decision_patterns
    `);
    const existingSignatures = new Set(existing.rows.map(r => r.pattern_signature));
    
    console.log(`\n📊 Starting with ${existingSignatures.size} existing patterns\n`);
    
    // Get ALL conversations, not just 50
    const conversations = await db.query(`
      SELECT id, phone_number, customer_name, messages
      FROM openphone_conversations
      WHERE jsonb_array_length(messages) > 2
      ORDER BY created_at DESC
    `);
    
    console.log(`Processing ${conversations.rows.length} total conversations...\n`);
    
    let patternsCreated = 0;
    let patternsSkipped = 0;
    let duplicates = 0;
    
    for (const conv of conversations.rows) {
      const messages = conv.messages || [];
      
      for (let i = 0; i < messages.length - 1; i++) {
        const inMsg = messages[i];
        const outMsg = messages[i + 1];
        
        if (inMsg.direction === 'inbound' && outMsg.direction === 'outbound') {
          const customerText = inMsg.text || inMsg.body || '';
          const operatorText = outMsg.text || outMsg.body || '';
          
          // Skip if too short or automated
          if (customerText.length < 20 || operatorText.length < 20 ||
              operatorText.includes('[Automated]') || operatorText.includes('🤖')) {
            continue;
          }
          
          // Check if we already have this pattern
          const signature = crypto.createHash('md5')
            .update(customerText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim())
            .digest('hex');
          
          if (existingSignatures.has(signature)) {
            duplicates++;
            continue;
          }
          
          try {
            const analysis = await openai.chat.completions.create({
              model: 'gpt-4-turbo-preview',
              messages: [{
                role: 'system',
                content: `Create a reusable pattern from this conversation.
                
                Return JSON with:
                - pattern_type: booking, tech_issue, access, faq, gift_cards, hours, or general
                - intent: specific action needed
                - keywords: 3-5 key terms
                - response_template: use {{variables}} for dynamic parts
                - confidence: 0.70
                - is_useful: true if automatable, false if too specific
                - summary: one-line description`
              }, {
                role: 'user',
                content: `Customer: "${customerText}"\nOperator: "${operatorText}"`
              }],
              temperature: 0.3,
              response_format: { type: "json_object" }
            });
            
            const pattern = JSON.parse(analysis.choices[0].message.content || '{}');
            
            if (!pattern.is_useful) {
              patternsSkipped++;
              continue;
            }
            
            await db.query(`
              INSERT INTO decision_patterns (
                pattern_type, pattern_signature, trigger_text, trigger_keywords,
                response_template, action_template, confidence_score,
                created_from, notes
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
              pattern.pattern_type || 'general',
              signature,
              customerText.substring(0, 500),
              pattern.keywords || [],
              pattern.response_template,
              JSON.stringify({ intent: pattern.intent }),
              0.70,
              'bulk_learning',
              pattern.summary
            ]);
            
            patternsCreated++;
            existingSignatures.add(signature);
            process.stdout.write(`\r✅ Created: ${patternsCreated} | ⏭️ Skipped: ${patternsSkipped} | 🔁 Duplicates: ${duplicates}`);
            
            await new Promise(r => setTimeout(r, 1000)); // Rate limit
            
          } catch (error: any) {
            if (error.message.includes('rate_limit')) {
              console.log('\n⏸️ Rate limit hit, waiting 60s...');
              await new Promise(r => setTimeout(r, 60000));
            }
          }
        }
      }
    }
    
    console.log('\n\n📊 Final Results:');
    console.log(`✅ Patterns created: ${patternsCreated}`);
    console.log(`⏭️ Patterns skipped: ${patternsSkipped}`);
    console.log(`🔁 Duplicates avoided: ${duplicates}`);
    
    const final = await db.query(`
      SELECT COUNT(*) as total,
             AVG(confidence_score) as avg_conf,
             COUNT(CASE WHEN response_template LIKE '%{{%' THEN 1 END) as templated
      FROM decision_patterns
    `);
    
    console.log(`\n📈 Total patterns now: ${final.rows[0].total}`);
    console.log(`📊 With templates: ${final.rows[0].templated}`);
    console.log(`💪 Avg confidence: ${parseFloat(final.rows[0].avg_conf).toFixed(2)}`);
    
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await db.end();
  }
}

learnMorePatterns();