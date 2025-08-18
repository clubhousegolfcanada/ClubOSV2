/**
 * Process ALL conversations and extract valuable knowledge
 * Intelligent extraction with deduplication and quality scoring
 * Run with: npx tsx src/scripts/processAllConversations.ts
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { getOpenAIClient } from '../utils/openaiClient';
import { unifiedKnowledgeService } from '../services/unifiedKnowledgeService';

interface ProcessingStats {
  conversations: {
    total: number;
    processed: number;
    skipped: number;
    errors: number;
  };
  knowledge: {
    extracted: number;
    duplicates: number;
    lowQuality: number;
    added: number;
  };
  categories: Record<string, number>;
}

class ConversationProcessor {
  private stats: ProcessingStats = {
    conversations: { total: 0, processed: 0, skipped: 0, errors: 0 },
    knowledge: { extracted: 0, duplicates: 0, lowQuality: 0, added: 0 },
    categories: {}
  };

  private existingKnowledge = new Set<string>();
  private MIN_CONFIDENCE = 0.6;
  private MIN_MESSAGE_COUNT = 3; // Skip very short conversations

  async initialize() {
    await db.initialize();
    
    // Load existing knowledge keys to prevent duplicates
    const existing = await db.query(`
      SELECT key, value->>'content' as content 
      FROM knowledge_store 
      WHERE superseded_by IS NULL
    `);
    
    for (const row of existing.rows) {
      // Create a normalized version for comparison
      const normalized = this.normalizeContent(row.content || row.key);
      this.existingKnowledge.add(normalized);
    }
    
    console.log(`📚 Loaded ${this.existingKnowledge.size} existing knowledge items\n`);
  }

  /**
   * Process all unprocessed conversations
   */
  async processAll(limit: number = 1000) {
    console.log('🔄 PROCESSING CONVERSATIONS FOR KNOWLEDGE EXTRACTION\n');
    console.log('=' .repeat(60) + '\n');

    // Get both conversation types
    const sources = [
      { table: 'openphone_conversations', processed_col: 'processed' },
      { table: 'conversation_sessions', processed_col: null } // No processed flag
    ];

    for (const source of sources) {
      await this.processSource(source, Math.floor(limit / 2));
    }

    this.printStats();
  }

  /**
   * Process conversations from a specific source
   */
  private async processSource(
    source: { table: string; processed_col: string | null },
    limit: number
  ) {
    console.log(`\n📱 Processing ${source.table}...\n`);

    // Build query based on whether there's a processed column
    let query = `SELECT * FROM ${source.table} WHERE 1=1`;
    
    if (source.processed_col) {
      query += ` AND (${source.processed_col} = false OR ${source.processed_col} IS NULL)`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $1`;

    const conversations = await db.query(query, [limit]);
    this.stats.conversations.total += conversations.rows.length;

    console.log(`Found ${conversations.rows.length} conversations to process\n`);

    for (const conversation of conversations.rows) {
      await this.processConversation(conversation, source.table);
      
      // Progress indicator
      if (this.stats.conversations.processed % 10 === 0) {
        process.stdout.write(`  Processed: ${this.stats.conversations.processed}/${this.stats.conversations.total}\r`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Process a single conversation
   */
  private async processConversation(conversation: any, sourceTable: string) {
    try {
      // Extract messages based on table structure
      let messages: any[] = [];
      let conversationText = '';
      
      if (sourceTable === 'openphone_conversations') {
        messages = conversation.messages || [];
        if (messages.length < this.MIN_MESSAGE_COUNT) {
          this.stats.conversations.skipped++;
          return;
        }
        
        conversationText = messages.map((msg: any) => {
          const role = msg.direction === 'inbound' ? 'Customer' : 'Support';
          return `${role}: ${msg.body || msg.text || ''}`;
        }).join('\n');
        
      } else if (sourceTable === 'conversation_sessions') {
        const metadata = conversation.metadata || {};
        messages = metadata.messages || [];
        
        if (messages.length < this.MIN_MESSAGE_COUNT) {
          this.stats.conversations.skipped++;
          return;
        }
        
        conversationText = messages.map((msg: any) => {
          const role = msg.role === 'user' ? 'Customer' : 'Support';
          return `${role}: ${msg.content || ''}`;
        }).join('\n');
      }

      if (!conversationText || conversationText.length < 100) {
        this.stats.conversations.skipped++;
        return;
      }

      // Extract knowledge using enhanced prompt
      const knowledge = await this.extractKnowledge(conversationText, conversation.id);
      
      // Process and store extracted knowledge
      for (const item of knowledge) {
        await this.storeKnowledge(item, conversation.id, sourceTable);
      }

      // Mark as processed if applicable
      if (sourceTable === 'openphone_conversations') {
        await db.query(
          `UPDATE openphone_conversations SET processed = true WHERE id = $1`,
          [conversation.id]
        );
      }

      this.stats.conversations.processed++;
      
    } catch (error) {
      logger.error(`Error processing conversation ${conversation.id}:`, error);
      this.stats.conversations.errors++;
    }
  }

  /**
   * Extract knowledge using GPT-4
   */
  private async extractKnowledge(conversationText: string, conversationId: string) {
    const openai = getOpenAIClient();
    if (!openai) return [];

    const prompt = `Analyze this customer service conversation and extract ONLY the most valuable, reusable knowledge.

Conversation:
${conversationText.substring(0, 2000)}

Extract knowledge that would help answer future customer questions. Focus on:
1. Factual information about services, pricing, policies
2. Solutions to common problems
3. Clarifications about how things work
4. Important details customers often ask about

DO NOT extract:
- Personal/specific booking details
- One-time issues
- Small talk or greetings
- Information already obvious from context

For each valuable piece of knowledge:
- category: gift_cards, booking, pricing, hours, membership, technical, policies, general
- question: The question this knowledge answers
- answer: Clear, complete answer
- confidence: 0.0-1.0 (how valuable/reusable this is)
- keywords: Search terms that should find this knowledge

Return ONLY truly valuable, reusable knowledge.
Format as JSON: {"knowledge": [...]}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at extracting valuable, reusable knowledge from conversations. Be selective - only extract truly useful information.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{"knowledge": []}');
      this.stats.knowledge.extracted += result.knowledge?.length || 0;
      
      return result.knowledge || [];
      
    } catch (error) {
      logger.error('Knowledge extraction failed:', error);
      return [];
    }
  }

  /**
   * Store knowledge with deduplication
   */
  private async storeKnowledge(item: any, conversationId: string, sourceTable: string) {
    // Check confidence threshold
    if (item.confidence < this.MIN_CONFIDENCE) {
      this.stats.knowledge.lowQuality++;
      return;
    }

    // Check for duplicates
    const normalized = this.normalizeContent(item.answer);
    if (this.existingKnowledge.has(normalized)) {
      this.stats.knowledge.duplicates++;
      return;
    }

    // Create knowledge key
    const key = `conversation.${item.category}.${conversationId}.${Date.now()}`;

    try {
      // Add to knowledge_store
      await db.query(`
        INSERT INTO knowledge_store (
          key, value, confidence, category, source_type, source_id, source_table
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7
        )
        ON CONFLICT (key) DO NOTHING
      `, [
        key,
        JSON.stringify({
          question: item.question,
          answer: item.answer,
          content: item.answer,
          keywords: item.keywords || [],
          conversation_id: conversationId
        }),
        item.confidence * 0.8, // Reduce confidence for extracted knowledge
        item.category || 'general',
        'conversation_extraction',
        conversationId,
        sourceTable
      ]);

      // Track the addition
      this.existingKnowledge.add(normalized);
      this.stats.knowledge.added++;
      
      // Track category
      this.stats.categories[item.category] = (this.stats.categories[item.category] || 0) + 1;
      
    } catch (error) {
      logger.error('Failed to store knowledge:', error);
    }
  }

  /**
   * Normalize content for duplicate detection
   */
  private normalizeContent(content: string): string {
    return content
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 100); // First 100 chars normalized
  }

  /**
   * Print processing statistics
   */
  private printStats() {
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 PROCESSING COMPLETE\n');
    
    console.log('Conversations:');
    console.log(`  Total: ${this.stats.conversations.total}`);
    console.log(`  Processed: ${this.stats.conversations.processed}`);
    console.log(`  Skipped (too short): ${this.stats.conversations.skipped}`);
    console.log(`  Errors: ${this.stats.conversations.errors}`);
    
    console.log('\nKnowledge:');
    console.log(`  Extracted: ${this.stats.knowledge.extracted}`);
    console.log(`  Added: ${this.stats.knowledge.added}`);
    console.log(`  Duplicates: ${this.stats.knowledge.duplicates}`);
    console.log(`  Low Quality: ${this.stats.knowledge.lowQuality}`);
    
    if (Object.keys(this.stats.categories).length > 0) {
      console.log('\nBy Category:');
      for (const [category, count] of Object.entries(this.stats.categories)) {
        console.log(`  ${category}: ${count}`);
      }
    }
    
    // Success rate
    const successRate = this.stats.knowledge.added / Math.max(this.stats.knowledge.extracted, 1);
    console.log(`\n✅ Success Rate: ${(successRate * 100).toFixed(1)}%`);
    
    // Final knowledge count
    db.query('SELECT COUNT(*) FROM knowledge_store WHERE superseded_by IS NULL')
      .then(result => {
        console.log(`\n📚 Total Knowledge Items: ${result.rows[0].count}`);
        console.log('='.repeat(60) + '\n');
      });
  }
}

// Run the processor
async function main() {
  const processor = new ConversationProcessor();
  
  try {
    await processor.initialize();
    
    // Process conversations (limit to prevent timeout)
    await processor.processAll(100); // Start with 100 conversations
    
    console.log('\n🎉 Processing complete!');
    console.log('Run again to process more conversations.\n');
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    process.exit(0);
  }
}

main();