#!/usr/bin/env tsx
/**
 * Learn Patterns from Full Conversation Flows
 * Analyzes entire conversation threads to understand context and multi-step interactions
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
  console.error('Run with: railway run npx tsx scripts/learn-conversation-flows.ts');
  process.exit(1);
}

interface ConversationFlow {
  messages: any[];
  resolution: string;
  pattern_type: string;
  key_moments: number[]; // Indices of important messages
  requires_context: boolean;
}

async function analyzeConversationFlow(messages: any[]): Promise<ConversationFlow | null> {
  try {
    // Build conversation transcript
    const transcript = messages.map((msg, i) => {
      const dir = msg.direction === 'inbound' ? 'CUSTOMER' : 'OPERATOR';
      const text = msg.text || msg.body || '';
      return `[${i+1}] ${dir}: ${text}`;
    }).join('\n');
    
    // Analyze the full conversation flow
    const analysis = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{
        role: 'system',
        content: `Analyze this complete customer service conversation to understand the flow and context.
        
        Identify:
        1. What problem was being solved
        2. Which messages were critical to understanding/resolution
        3. Whether context from earlier messages was needed
        4. Patterns that could be automated
        
        Return JSON with:
        - pattern_type: booking, tech_issue, access, faq, gift_cards, hours, or complex
        - problem: what the customer needed
        - resolution: how it was resolved
        - key_exchanges: array of {customer_msg_index, operator_msg_index, purpose}
        - requires_multi_step: boolean - needs multiple exchanges
        - patterns: array of automatable patterns with context
        - summary: description of the conversation flow`
      }, {
        role: 'user',
        content: `Full Conversation:\n${transcript}`
      }],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });
    
    return JSON.parse(analysis.choices[0].message.content || 'null');
  } catch (error) {
    console.error('Error analyzing flow:', error);
    return null;
  }
}

async function createContextAwarePattern(
  messages: any[], 
  keyExchange: any,
  flowAnalysis: any
): Promise<void> {
  try {
    // Get the context window (2-3 messages before and after key exchange)
    const startIdx = Math.max(0, keyExchange.customer_msg_index - 2);
    const endIdx = Math.min(messages.length - 1, keyExchange.operator_msg_index + 1);
    const contextWindow = messages.slice(startIdx, endIdx + 1);
    
    // Build context for GPT-4
    const contextTranscript = contextWindow.map(msg => {
      const dir = msg.direction === 'inbound' ? 'Customer' : 'Operator';
      return `${dir}: ${msg.text || msg.body}`;
    }).join('\n');
    
    // Create a pattern that understands context
    const patternAnalysis = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{
        role: 'system',
        content: `Create a context-aware pattern from this conversation segment.
        
        The full conversation was about: ${flowAnalysis.problem}
        This specific exchange handled: ${keyExchange.purpose}
        
        Create a pattern that:
        1. Recognizes when similar context appears
        2. Knows what information to gather
        3. Can provide appropriate responses
        
        Return JSON with:
        - pattern_type: specific type
        - trigger_conditions: what to look for (not just keywords)
        - context_needed: what info from earlier messages is required
        - information_to_gather: what to ask if missing
        - response_templates: array of possible responses based on context
        - follow_up_needed: boolean
        - confidence: 0.65-0.85 based on complexity
        - summary: what this pattern handles`
      }, {
        role: 'user',
        content: contextTranscript
      }],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });
    
    const pattern = JSON.parse(patternAnalysis.choices[0].message.content || '{}');
    
    // Generate signature based on trigger conditions
    const signature = crypto.createHash('md5')
      .update(JSON.stringify(pattern.trigger_conditions))
      .digest('hex');
    
    // Store the context-aware pattern
    await db.query(`
      INSERT INTO decision_patterns (
        pattern_type, 
        pattern_signature, 
        trigger_text,
        trigger_keywords,
        response_template,
        action_template,
        confidence_score,
        requires_confirmation,
        created_from,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (pattern_signature) DO UPDATE
      SET action_template = EXCLUDED.action_template,
          confidence_score = GREATEST(decision_patterns.confidence_score, EXCLUDED.confidence_score)
    `, [
      pattern.pattern_type || 'complex',
      signature,
      JSON.stringify(pattern.trigger_conditions),
      pattern.context_needed || [],
      pattern.response_templates?.[0] || 'Needs context',
      JSON.stringify({
        context_needed: pattern.context_needed,
        information_to_gather: pattern.information_to_gather,
        response_templates: pattern.response_templates,
        follow_up_needed: pattern.follow_up_needed
      }),
      pattern.confidence || 0.65,
      pattern.follow_up_needed || false,
      'conversation_flow_learning',
      pattern.summary
    ]);
    
  } catch (error) {
    console.error('Error creating pattern:', error);
  }
}

async function learnFromConversationFlows() {
  try {
    console.log('🔄 Learning from complete conversation flows...\n');
    
    // Get conversations with substantial back-and-forth
    const conversations = await db.query(`
      SELECT id, phone_number, customer_name, messages
      FROM openphone_conversations
      WHERE jsonb_array_length(messages) >= 4
      ORDER BY jsonb_array_length(messages) DESC
      LIMIT 30
    `);
    
    console.log(`Analyzing ${conversations.rows.length} multi-message conversations...\n`);
    
    let flowsAnalyzed = 0;
    let patternsCreated = 0;
    let contextualPatterns = 0;
    
    for (const conv of conversations.rows) {
      const messages = conv.messages || [];
      
      console.log(`\n📱 Conversation ${flowsAnalyzed + 1}: ${messages.length} messages`);
      
      // Analyze the full conversation flow
      const flowAnalysis = await analyzeConversationFlow(messages);
      
      if (!flowAnalysis) {
        console.log('  ⏭️ Skipped - no clear pattern');
        continue;
      }
      
      flowsAnalyzed++;
      console.log(`  📊 Type: ${flowAnalysis.pattern_type}`);
      console.log(`  🎯 Problem: ${flowAnalysis.problem}`);
      console.log(`  ✅ Resolution: ${flowAnalysis.resolution}`);
      
      // Create patterns from key exchanges
      if (flowAnalysis.patterns && flowAnalysis.patterns.length > 0) {
        for (const pattern of flowAnalysis.patterns) {
          if (pattern.requires_multi_step) {
            contextualPatterns++;
            console.log(`  🔗 Creating context-aware pattern...`);
          }
          
          // Extract key exchanges
          if (flowAnalysis.key_exchanges) {
            for (const exchange of flowAnalysis.key_exchanges) {
              await createContextAwarePattern(messages, exchange, flowAnalysis);
              patternsCreated++;
              await new Promise(r => setTimeout(r, 1500)); // Rate limit
            }
          }
        }
      }
      
      console.log(`  ✨ Created ${patternsCreated} patterns (${contextualPatterns} contextual)`);
    }
    
    console.log('\n\n📊 === FLOW LEARNING COMPLETE ===\n');
    console.log(`🔍 Flows analyzed: ${flowsAnalyzed}`);
    console.log(`✅ Patterns created: ${patternsCreated}`);
    console.log(`🔗 Context-aware patterns: ${contextualPatterns}`);
    
    // Show complex patterns
    const complexPatterns = await db.query(`
      SELECT pattern_type, notes, confidence_score
      FROM decision_patterns
      WHERE created_from = 'conversation_flow_learning'
        AND pattern_type = 'complex'
      LIMIT 5
    `);
    
    if (complexPatterns.rows.length > 0) {
      console.log('\n🧩 Sample Complex Patterns:');
      complexPatterns.rows.forEach((p, i) => {
        console.log(`${i+1}. ${p.notes} (confidence: ${p.confidence_score})`);
      });
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await db.end();
  }
}

learnFromConversationFlows();