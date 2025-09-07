#!/usr/bin/env tsx
/**
 * Upgrade Basic Patterns to GPT-4 Enhanced Patterns
 * 
 * This script re-processes existing basic patterns through GPT-4
 * to extract proper context, entities, and create template responses
 * 
 * MUST BE RUN WHERE OPENAI_API_KEY IS CONFIGURED!
 */

import { Pool } from 'pg';
import { logger } from '../src/utils/logger';
import OpenAI from 'openai';

// Use direct pool connection for scripts
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Check for OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  logger.error('OPENAI_API_KEY not configured! This script requires OpenAI.');
  logger.error('Either:');
  logger.error('1. Run this on Railway where OpenAI is configured');
  logger.error('2. Set OPENAI_API_KEY locally');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function upgradePatterns() {
  try {
    logger.info('Starting pattern upgrade with GPT-4...');
    
    // Get all basic patterns (confidence = 0.50, no keywords)
    const patterns = await db.query(`
      SELECT id, pattern_type, trigger_text, response_template
      FROM decision_patterns
      WHERE confidence_score = 0.50
        AND (trigger_keywords IS NULL OR trigger_keywords = '{}')
      ORDER BY id
    `);
    
    logger.info(`Found ${patterns.rows.length} basic patterns to upgrade`);
    
    let upgraded = 0;
    let failed = 0;
    
    for (const pattern of patterns.rows) {
      try {
        logger.info(`Upgrading pattern ${pattern.id}...`);
        
        // Use GPT-4 to analyze and enhance the pattern
        const analysis = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [{
            role: 'system',
            content: `Analyze this customer service interaction and extract a reusable pattern.
              
              Return JSON with:
              - pattern_type: one of [booking, tech_issue, access, faq, gift_cards, hours]
              - intent: what the customer wants (e.g., "book_bay", "report_issue", "get_access")
              - entities: object with extracted entities (bay_number, time, date, issue_type, etc.)
              - keywords: array of important keywords for matching
              - sentiment: customer sentiment (positive, neutral, negative, frustrated, apologetic)
              - urgency: low, medium, high
              - response_template: generalized response with variables like {{bay_number}}, {{customer_name}}, {{time}}
              - suggested_actions: array of actions to take (e.g., ["reset_trackman", "send_compensation"])
              - confidence: initial confidence (0.50-0.70)
              - context_required: array of context needed (e.g., ["booking_time", "bay_number"])
              - is_edge_case: boolean
              - summary: brief description of the pattern
              
              IMPORTANT: Create a TEMPLATE response, not the exact response. 
              Replace specific values with variables:
              - Bay numbers → {{bay_number}}
              - Times → {{time}}
              - Dates → {{date}}
              - Names → {{customer_name}}
              - Codes → {{code}}
              - Locations → {{location}}`
          }, {
            role: 'user',
            content: `Customer Message: "${pattern.trigger_text}"
Operator Response: "${pattern.response_template}"
Current Type: ${pattern.pattern_type}`
          }],
          temperature: 0.3,
          response_format: { type: "json_object" }
        });

        const enhanced = JSON.parse(analysis.choices[0].message.content || '{}');
        
        // Update the pattern with enhanced data
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
            intent: enhanced.intent,
            sentiment: enhanced.sentiment,
            urgency: enhanced.urgency,
            context_required: enhanced.context_required
          }) : null,
          enhanced.confidence || 0.60,
          enhanced.summary || 'GPT-4 enhanced pattern',
          pattern.id
        ]);
        
        upgraded++;
        
        logger.info(`✅ Upgraded pattern ${pattern.id}`, {
          type: enhanced.pattern_type,
          intent: enhanced.intent,
          entities: Object.keys(enhanced.entities || {}),
          hasTemplate: enhanced.response_template?.includes('{{')
        });
        
        // Rate limit to avoid OpenAI limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        logger.error(`Failed to upgrade pattern ${pattern.id}:`, error);
        failed++;
      }
      
      if (upgraded % 10 === 0) {
        logger.info(`Progress: ${upgraded} upgraded, ${failed} failed, ${patterns.rows.length - upgraded - failed} remaining`);
      }
    }
    
    // Get summary of upgraded patterns
    const summary = await db.query(`
      SELECT 
        pattern_type,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence,
        COUNT(CASE WHEN response_template LIKE '%{{%' THEN 1 END) as templated_responses
      FROM decision_patterns
      GROUP BY pattern_type
      ORDER BY count DESC
    `);
    
    logger.info('=== UPGRADE COMPLETE ===');
    logger.info(`Patterns upgraded: ${upgraded}`);
    logger.info(`Patterns failed: ${failed}`);
    logger.info('Pattern summary:', summary.rows);
    
    // Show sample of upgraded patterns
    const samples = await db.query(`
      SELECT pattern_type, trigger_text, response_template
      FROM decision_patterns
      WHERE response_template LIKE '%{{%'
      LIMIT 5
    `);
    
    logger.info('Sample upgraded patterns with templates:');
    samples.rows.forEach(s => {
      logger.info(`Type: ${s.pattern_type}`);
      logger.info(`Trigger: ${s.trigger_text.substring(0, 50)}...`);
      logger.info(`Template: ${s.response_template}`);
      logger.info('---');
    });
    
  } catch (error) {
    logger.error('Upgrade failed:', error);
    process.exit(1);
  } finally {
    await db.end();
    process.exit(0);
  }
}

// Run the upgrade
upgradePatterns();