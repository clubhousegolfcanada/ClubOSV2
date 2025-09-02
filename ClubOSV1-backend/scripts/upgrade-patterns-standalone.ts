#!/usr/bin/env tsx
/**
 * Standalone Pattern Upgrade Script
 * Uses external database URL that works from local machine
 */

import { Pool } from 'pg';
import OpenAI from 'openai';

// Use the external Railway database URL
const EXTERNAL_DATABASE_URL = 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway';

const db = new Pool({
  connectionString: EXTERNAL_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Check for OpenAI API key
const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error('OPENAI_API_KEY not set! Run with Railway: railway run npx tsx scripts/upgrade-patterns-standalone.ts');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });

async function upgradePatterns() {
  try {
    console.log('Starting pattern upgrade with GPT-4...');
    
    // Get all basic patterns that haven't been upgraded yet
    const patterns = await db.query(`
      SELECT id, pattern_type, trigger_text, response_template
      FROM decision_patterns
      WHERE confidence_score = 0.50
        AND (response_template NOT LIKE '%{{%' OR response_template IS NULL)
      ORDER BY id
    `);
    
    console.log(`Found ${patterns.rows.length} patterns to upgrade`);
    
    let upgraded = 0;
    let failed = 0;
    
    for (const pattern of patterns.rows) {
      try {
        process.stdout.write(`\rUpgrading pattern ${pattern.id} (${upgraded + failed + 1}/${patterns.rows.length})...`);
        
        // Use GPT-4 to analyze and enhance the pattern
        const analysis = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [{
            role: 'system',
            content: `Analyze this customer service interaction and extract a reusable pattern.
              
              Return JSON with:
              - pattern_type: one of [booking, tech_issue, access, faq, gift_cards, hours]
              - intent: what the customer wants
              - entities: extracted entities (bay_number, time, date, etc.)
              - keywords: important keywords for matching
              - sentiment: customer sentiment
              - urgency: low, medium, high
              - response_template: generalized response with variables like {{bay_number}}, {{customer_name}}
              - suggested_actions: array of actions to take
              - confidence: initial confidence (0.50-0.70)
              - summary: brief description
              
              IMPORTANT: Create a TEMPLATE response with variables, not the exact response.`
          }, {
            role: 'user',
            content: `Customer: "${pattern.trigger_text}"
Operator: "${pattern.response_template}"
Type: ${pattern.pattern_type}`
          }],
          temperature: 0.3,
          response_format: { type: "json_object" }
        });

        const enhanced = JSON.parse(analysis.choices[0].message.content || '{}');
        
        // Update the pattern
        await db.query(`
          UPDATE decision_patterns
          SET 
            pattern_type = $1,
            trigger_keywords = $2,
            response_template = $3,
            action_template = $4,
            confidence_score = $5,
            notes = $6,
            last_modified = NOW()
          WHERE id = $7
        `, [
          enhanced.pattern_type || pattern.pattern_type,
          enhanced.keywords || [],
          enhanced.response_template || pattern.response_template,
          enhanced.suggested_actions ? JSON.stringify({
            actions: enhanced.suggested_actions,
            entities: enhanced.entities,
            intent: enhanced.intent
          }) : null,
          enhanced.confidence || 0.60,
          enhanced.summary || 'GPT-4 enhanced pattern',
          pattern.id
        ]);
        
        upgraded++;
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error: any) {
        console.error(`\nFailed pattern ${pattern.id}:`, error.message);
        failed++;
      }
    }
    
    console.log('\n\n=== UPGRADE COMPLETE ===');
    console.log(`Patterns upgraded: ${upgraded}`);
    console.log(`Patterns failed: ${failed}`);
    
    // Show summary
    const summary = await db.query(`
      SELECT 
        pattern_type,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence,
        COUNT(CASE WHEN response_template LIKE '%{{%' THEN 1 END) as templated
      FROM decision_patterns
      GROUP BY pattern_type
    `);
    
    console.log('\nPattern summary:');
    summary.rows.forEach(s => {
      console.log(`  ${s.pattern_type}: ${s.count} patterns (${s.templated} templated)`);
    });
    
  } catch (error: any) {
    console.error('Upgrade failed:', error.message);
  } finally {
    await db.end();
  }
}

upgradePatterns();