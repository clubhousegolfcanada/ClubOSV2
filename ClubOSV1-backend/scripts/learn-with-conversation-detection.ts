#!/usr/bin/env tsx
/**
 * Advanced Pattern Learning with Conversation Boundary Detection
 * Uses GPT-4 to detect when conversations actually start/end based on context
 * not just message timestamps
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
  console.error('Run with: railway run npx tsx scripts/learn-with-conversation-detection.ts');
  process.exit(1);
}

interface ConversationSegment {
  start_index: number;
  end_index: number;
  topic: string;
  complete: boolean;
  resolution: string;
  pattern_type: string;
}

async function detectConversationBoundaries(messages: any[]): Promise<ConversationSegment[]> {
  try {
    // Build full transcript with timestamps
    const transcript = messages.map((msg, i) => {
      const dir = msg.direction === 'inbound' ? 'CUSTOMER' : 'OPERATOR';
      const text = msg.text || msg.body || '';
      const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : '';
      return `[${i}] ${time} ${dir}: ${text}`;
    }).join('\n');
    
    // Let GPT-4 detect conversation boundaries
    const analysis = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{
        role: 'system',
        content: `Analyze this message thread and identify separate conversations within it.
        
        Look for:
        1. Topic changes (customer switches to different issue)
        2. Natural conversation endings (thank you, goodbye, problem solved)
        3. New greetings after resolution
        4. Time gaps suggesting new session
        5. Context switches (different bay, different day, different problem)
        
        A conversation might span multiple messages if they're discussing the same issue.
        
        Return JSON with array of conversations:
        - start_index: message index where conversation starts
        - end_index: message index where it ends
        - topic: what the conversation is about
        - complete: was it fully resolved
        - resolution: how it ended
        - pattern_type: booking, tech_issue, access, faq, etc.
        - key_messages: indices of most important messages`
      }, {
        role: 'user',
        content: `Message Thread:\n${transcript}`
      }],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });
    
    const result = JSON.parse(analysis.choices[0].message.content || '{"conversations": []}');
    return result.conversations || [];
    
  } catch (error) {
    console.error('Error detecting boundaries:', error);
    return [];
  }
}

async function learnFromSegment(
  messages: any[], 
  segment: ConversationSegment,
  phoneNumber: string
): Promise<number> {
  try {
    const segmentMessages = messages.slice(segment.start_index, segment.end_index + 1);
    
    // Build conversation context
    const context = segmentMessages.map(msg => ({
      role: msg.direction === 'inbound' ? 'customer' : 'operator',
      content: msg.text || msg.body || ''
    }));
    
    // Analyze this complete conversation
    const patternAnalysis = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{
        role: 'system',
        content: `Analyze this complete conversation about "${segment.topic}".
        
        Extract ALL learnable patterns, including:
        1. Initial problem recognition patterns
        2. Information gathering patterns  
        3. Solution delivery patterns
        4. Follow-up/confirmation patterns
        
        For EACH pattern found, return:
        - stage: initial, gathering, solution, or followup
        - trigger: what triggers this pattern
        - context_required: what must be known already
        - response_template: template with {{variables}}
        - next_action: what typically happens next
        - confidence: 0.60-0.90 based on clarity
        
        Return JSON with:
        - patterns: array of all patterns found
        - conversation_flow: description of overall flow
        - total_patterns: count of patterns extracted`
      }, {
        role: 'user',
        content: JSON.stringify(context)
      }],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });
    
    const analysis = JSON.parse(patternAnalysis.choices[0].message.content || '{"patterns": []}');
    let patternsCreated = 0;
    
    // Store each pattern found
    for (const pattern of analysis.patterns || []) {
      const signature = crypto.createHash('md5')
        .update(`${pattern.trigger}-${pattern.stage}`)
        .digest('hex');
      
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
        SET confidence_score = GREATEST(decision_patterns.confidence_score, EXCLUDED.confidence_score),
            execution_count = decision_patterns.execution_count + 1
      `, [
        segment.pattern_type,
        signature,
        pattern.trigger,
        pattern.trigger?.split(' ').filter((w: string) => w.length > 3).slice(0, 5) || [],
        pattern.response_template,
        JSON.stringify({
          stage: pattern.stage,
          context_required: pattern.context_required,
          next_action: pattern.next_action,
          conversation_flow: analysis.conversation_flow
        }),
        pattern.confidence || 0.70,
        pattern.stage === 'solution',
        'boundary_detection',
        `${pattern.stage}: ${pattern.trigger?.substring(0, 50)}`
      ]);
      
      patternsCreated++;
    }
    
    return patternsCreated;
    
  } catch (error) {
    console.error('Error learning from segment:', error);
    return 0;
  }
}

async function learnWithBoundaryDetection() {
  try {
    console.log('🧠 Advanced Pattern Learning with Conversation Detection\n');
    
    // Get all conversations
    const conversations = await db.query(`
      SELECT id, phone_number, customer_name, messages
      FROM openphone_conversations
      WHERE jsonb_array_length(messages) > 2
      ORDER BY created_at DESC
    `);
    
    console.log(`Processing ${conversations.rows.length} message threads...\n`);
    
    let totalSegments = 0;
    let totalPatterns = 0;
    let multiStepConversations = 0;
    
    for (const conv of conversations.rows) {
      const messages = conv.messages || [];
      
      // Detect conversation boundaries
      const segments = await detectConversationBoundaries(messages);
      
      if (segments.length === 0) continue;
      
      console.log(`\n📱 Thread with ${messages.length} messages → ${segments.length} conversations detected`);
      
      for (const segment of segments) {
        const messageCount = segment.end_index - segment.start_index + 1;
        console.log(`  📌 ${segment.topic} (${messageCount} messages)`);
        
        if (messageCount >= 4) {
          multiStepConversations++;
          console.log(`    🔄 Multi-step conversation detected`);
        }
        
        // Learn patterns from this segment
        const patternsFound = await learnFromSegment(
          messages, 
          segment,
          conv.phone_number
        );
        
        totalPatterns += patternsFound;
        console.log(`    ✅ Extracted ${patternsFound} patterns`);
        
        totalSegments++;
        
        // Rate limiting
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    
    console.log('\n\n📊 === BOUNDARY DETECTION COMPLETE ===\n');
    console.log(`🔍 Total conversations detected: ${totalSegments}`);
    console.log(`🔄 Multi-step conversations: ${multiStepConversations}`);
    console.log(`✅ Total patterns extracted: ${totalPatterns}`);
    
    // Show pattern stages
    const stages = await db.query(`
      SELECT 
        action_template->>'stage' as stage,
        COUNT(*) as count,
        AVG(confidence_score) as avg_conf
      FROM decision_patterns
      WHERE created_from = 'boundary_detection'
      GROUP BY action_template->>'stage'
    `);
    
    if (stages.rows.length > 0) {
      console.log('\n📈 Patterns by Conversation Stage:');
      stages.rows.forEach(s => {
        console.log(`  ${s.stage}: ${s.count} patterns (avg conf: ${parseFloat(s.avg_conf).toFixed(2)})`);
      });
    }
    
    // Show sample multi-step pattern
    const multiStep = await db.query(`
      SELECT 
        pattern_type,
        notes,
        action_template->>'conversation_flow' as flow
      FROM decision_patterns
      WHERE created_from = 'boundary_detection'
        AND action_template->>'stage' = 'solution'
      LIMIT 1
    `);
    
    if (multiStep.rows.length > 0) {
      const p = multiStep.rows[0];
      console.log('\n🔗 Sample Multi-Step Pattern:');
      console.log(`  Type: ${p.pattern_type}`);
      console.log(`  Pattern: ${p.notes}`);
      console.log(`  Flow: ${p.flow}`);
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await db.end();
  }
}

learnWithBoundaryDetection();