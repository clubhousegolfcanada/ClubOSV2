#!/usr/bin/env tsx
/**
 * Upgrade Basic Patterns to GPT-4 Enhanced Patterns - Local Version
 * 
 * This script re-processes existing basic patterns through GPT-4
 * to extract proper context, entities, and create template responses
 */

import { config } from 'dotenv';
import { Pool } from 'pg';
import OpenAI from 'openai';

// Load environment variables
config();

// Simple console logger for the script
const logger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args)
};

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
  logger.error('2. Set OPENAI_API_KEY in your .env file');
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
        logger.info(`Processing pattern ${pattern.id}: "${pattern.trigger_text?.substring(0, 50)}..."`);
        
        // Use GPT-4 to analyze and enhance the pattern
        const analysis = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{
            role: 'system',
            content: `You are analyzing customer service patterns to extract templates with variables.
              
              Replace specific values with template variables:
              - Names → {{customer_name}}
              - Bay numbers → {{bay_number}}
              - Times → {{time}}
              - Dates → {{date}}
              - Locations → {{location}}
              - Amounts → {{amount}}
              - Codes → {{code}}
              
              Extract keywords that would trigger this pattern.
              
              Return JSON with:
              {
                "keywords": ["key", "words", "that", "trigger"],
                "template": "Response with {{variables}}",
                "entities": {"bay_number": "3", "time": "7pm"},
                "improved_type": "booking|tech_issue|access|faq|gift_cards|hours",
                "summary": "Brief description"
              }`
          }, {
            role: 'user',
            content: `Customer: "${pattern.trigger_text}"\nOperator: "${pattern.response_template}"`
          }],
          temperature: 0.3,
          response_format: { type: "json_object" }
        });
        
        const result = JSON.parse(analysis.choices[0].message.content || '{}');
        
        // Update the pattern with enhanced data
        await db.query(`
          UPDATE decision_patterns
          SET trigger_keywords = $1,
              response_template = $2,
              pattern_type = $3,
              notes = $4,
              action_template = $5,
              last_modified = NOW()
          WHERE id = $6
        `, [
          result.keywords || [],
          result.template || pattern.response_template,
          result.improved_type || pattern.pattern_type,
          result.summary || 'GPT-4 enhanced pattern',
          result.entities ? JSON.stringify({ entities: result.entities }) : null,
          pattern.id
        ]);
        
        logger.info(`✅ Upgraded pattern ${pattern.id}`);
        upgraded++;
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        logger.error(`Failed to upgrade pattern ${pattern.id}:`, error);
        failed++;
      }
    }
    
    logger.info(`\n=== UPGRADE COMPLETE ===`);
    logger.info(`✅ Successfully upgraded: ${upgraded} patterns`);
    logger.info(`❌ Failed: ${failed} patterns`);
    
    // Now generate embeddings for semantic search
    logger.info('\nGenerating embeddings for semantic search...');
    
    const updatedPatterns = await db.query(`
      SELECT id, trigger_text
      FROM decision_patterns
      WHERE trigger_keywords IS NOT NULL AND trigger_keywords != '{}'
        AND embedding IS NULL
      LIMIT 100
    `);
    
    logger.info(`Generating embeddings for ${updatedPatterns.rows.length} patterns...`);
    
    let embeddingCount = 0;
    for (const pattern of updatedPatterns.rows) {
      try {
        const embedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: pattern.trigger_text
        });
        
        await db.query(`
          UPDATE decision_patterns
          SET embedding = $1,
              semantic_search_enabled = true
          WHERE id = $2
        `, [embedding.data[0].embedding, pattern.id]);
        
        embeddingCount++;
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        logger.warn(`Could not generate embedding for pattern ${pattern.id}`);
      }
    }
    
    logger.info(`✅ Generated ${embeddingCount} embeddings`);
    
    // Enable pattern learning in config
    logger.info('\nEnabling pattern learning system...');
    await db.query(`
      UPDATE pattern_learning_config
      SET config_value = 'true'
      WHERE config_key = 'enabled'
    `);
    
    await db.query(`
      UPDATE pattern_learning_config
      SET config_value = 'true'
      WHERE config_key = 'shadow_mode'
    `);
    
    logger.info('✅ Pattern learning enabled in SHADOW MODE');
    logger.info('\n🎉 Pattern upgrade complete! The system is now ready for testing.');
    
  } catch (error) {
    logger.error('Fatal error during upgrade:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run the upgrade
upgradePatterns();