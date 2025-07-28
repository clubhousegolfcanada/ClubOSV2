import { OpenAI } from 'openai';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

interface ExtractedKnowledge {
  problem: string;
  solution: string;
  category: string;
  confidence: number;
  metadata?: any;
}

interface ConversationAnalysis {
  hasResolution: boolean;
  knowledge: ExtractedKnowledge[];
  summary: string;
}

export class KnowledgeExtractorService {
  private openai: OpenAI | null = null;
  private readonly MODEL = 'gpt-4o-mini'; // Cost-effective for extraction
  
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    } else {
      logger.warn('KnowledgeExtractor: OpenAI API key not configured');
    }
  }

  /**
   * Extract knowledge from OpenPhone conversations
   */
  async extractFromConversation(conversation: any): Promise<ConversationAnalysis> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    try {
      const messages = conversation.messages || [];
      const conversationText = this.formatConversation(messages);
      
      const prompt = `Analyze this customer service conversation and extract reusable knowledge.

Conversation:
${conversationText}

Extract:
1. Was the customer's issue resolved? (true/false)
2. What problems were discussed?
3. What solutions were provided?
4. Which category does this belong to? (emergency, booking, tech, brand, general)
5. Rate confidence in the solution (0.0-1.0)

Return a JSON object with:
{
  "hasResolution": boolean,
  "knowledge": [
    {
      "problem": "clear problem description",
      "solution": "clear solution description",
      "category": "emergency|booking|tech|brand|general",
      "confidence": 0.0-1.0
    }
  ],
  "summary": "brief conversation summary"
}

Only extract knowledge if:
- The problem is clearly defined
- A concrete solution was provided
- The solution appears to have worked
- This would be useful for future similar issues`;

      const response = await this.openai.chat.completions.create({
        model: this.MODEL,
        messages: [
          { role: 'system', content: 'You are a knowledge extraction expert for a golf simulator facility.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1000
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        hasResolution: analysis.hasResolution || false,
        knowledge: analysis.knowledge || [],
        summary: analysis.summary || ''
      };
      
    } catch (error) {
      logger.error('Knowledge extraction failed:', error);
      throw error;
    }
  }

  /**
   * Process unprocessed OpenPhone conversations
   */
  async processUnprocessedConversations(limit: number = 10): Promise<{
    processed: number;
    extracted: number;
    errors: number;
  }> {
    const stats = {
      processed: 0,
      extracted: 0,
      errors: 0
    };

    try {
      // Get unprocessed conversations
      const result = await db.query(`
        SELECT * FROM openphone_conversations 
        WHERE processed = false 
        ORDER BY created_at ASC 
        LIMIT $1
      `, [limit]);

      for (const conversation of result.rows) {
        try {
          // Extract knowledge
          const analysis = await this.extractFromConversation(conversation);
          
          // Store extracted knowledge
          for (const knowledge of analysis.knowledge) {
            if (knowledge.confidence >= 0.6) { // Only store high-confidence knowledge
              await this.storeExtractedKnowledge(
                conversation.id,
                'openphone',
                knowledge
              );
              stats.extracted++;
            }
          }
          
          // Mark as processed
          await db.query(`
            UPDATE openphone_conversations 
            SET processed = true,
                metadata = jsonb_set(
                  COALESCE(metadata, '{}')::jsonb,
                  '{analysis}',
                  $1::jsonb
                )
            WHERE id = $2
          `, [
            JSON.stringify({
              hasResolution: analysis.hasResolution,
              summary: analysis.summary,
              extractedCount: analysis.knowledge.length,
              processedAt: new Date().toISOString()
            }),
            conversation.id
          ]);
          
          stats.processed++;
          
          // Rate limiting - avoid hitting OpenAI too hard
          await this.delay(1000);
          
        } catch (error) {
          logger.error(`Failed to process conversation ${conversation.id}:`, error);
          stats.errors++;
        }
      }
      
    } catch (error) {
      logger.error('Failed to fetch conversations:', error);
      throw error;
    }
    
    return stats;
  }

  /**
   * Store extracted knowledge in database
   */
  private async storeExtractedKnowledge(
    sourceId: string,
    sourceType: string,
    knowledge: ExtractedKnowledge
  ): Promise<void> {
    await db.query(`
      INSERT INTO extracted_knowledge 
      (id, source_id, source_type, category, problem, solution, confidence, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      uuidv4(),
      sourceId,
      sourceType,
      knowledge.category,
      knowledge.problem,
      knowledge.solution,
      knowledge.confidence,
      JSON.stringify(knowledge.metadata || {})
    ]);
  }

  /**
   * Get unapplied knowledge for review
   */
  async getUnappliedKnowledge(category?: string, limit: number = 50): Promise<any[]> {
    let query = `
      SELECT * FROM extracted_knowledge 
      WHERE applied_to_sop = false
    `;
    const params: any[] = [];
    
    if (category) {
      query += ` AND category = $1`;
      params.push(category);
    }
    
    query += ` ORDER BY confidence DESC, created_at DESC LIMIT ${limit}`;
    
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Mark knowledge as applied to SOP
   */
  async markKnowledgeApplied(knowledgeId: string, sopFile: string): Promise<void> {
    await db.query(`
      UPDATE extracted_knowledge 
      SET applied_to_sop = true,
          sop_file = $1
      WHERE id = $2
    `, [sopFile, knowledgeId]);
  }

  /**
   * Get knowledge extraction statistics
   */
  async getExtractionStats(): Promise<any> {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_extracted,
        COUNT(CASE WHEN applied_to_sop = true THEN 1 END) as applied_count,
        COUNT(CASE WHEN applied_to_sop = false THEN 1 END) as pending_count,
        AVG(confidence) as avg_confidence,
        COUNT(DISTINCT source_id) as unique_sources
      FROM extracted_knowledge
    `);
    
    const byCategory = await db.query(`
      SELECT 
        category,
        COUNT(*) as count,
        AVG(confidence) as avg_confidence
      FROM extracted_knowledge
      GROUP BY category
      ORDER BY count DESC
    `);
    
    return {
      overview: stats.rows[0],
      byCategory: byCategory.rows
    };
  }

  /**
   * Format conversation messages for analysis
   */
  private formatConversation(messages: any[]): string {
    if (!Array.isArray(messages)) {
      return JSON.stringify(messages);
    }
    
    return messages
      .map(msg => {
        const sender = msg.from || msg.sender || 'Unknown';
        const text = msg.text || msg.content || msg.body || '';
        const time = msg.timestamp || msg.createdAt || '';
        return `[${time}] ${sender}: ${text}`;
      })
      .join('\n');
  }

  /**
   * Simple delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Batch process knowledge applications
   */
  async applyKnowledgeBatch(knowledgeIds: string[], sopFile: string): Promise<void> {
    await db.query(`
      UPDATE extracted_knowledge 
      SET applied_to_sop = true,
          sop_file = $1
      WHERE id = ANY($2)
    `, [sopFile, knowledgeIds]);
  }

  /**
   * Search for similar knowledge to avoid duplicates
   */
  async findSimilarKnowledge(problem: string, category: string): Promise<any[]> {
    // Simple text search - could be enhanced with embeddings later
    const result = await db.query(`
      SELECT * FROM extracted_knowledge
      WHERE category = $1
      AND (
        problem ILIKE $2
        OR solution ILIKE $2
      )
      ORDER BY confidence DESC
      LIMIT 10
    `, [category, `%${problem}%`]);
    
    return result.rows;
  }

  /**
   * Process manual knowledge entry from user
   */
  async processManualEntry(entry: string): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    try {
      const prompt = `Analyze this manual knowledge entry and format it for our SOP system.

Entry: "${entry}"

Extract and structure this information as follows:
1. Identify what problem or question this knowledge addresses
2. Provide the solution or answer in a clear, actionable format
3. Categorize it into one of: emergency, booking, tech, brand, or general
4. Rate your confidence (0-1) in the categorization

Example format:
- Problem: "What is the color code for Clubhouse Grey?"
- Solution: "Clubhouse Grey color code is #503285"
- Category: "brand"
- Confidence: 0.95

Return ONLY a valid JSON object with these fields: problem, solution, category, confidence`;

      const response = await this.openai.chat.completions.create({
        model: this.MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a knowledge management assistant for a golf simulator business. Extract and categorize information precisely.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // Validate the response
      if (!result.problem || !result.solution || !result.category || result.confidence === undefined) {
        throw new Error('Invalid response format from AI');
      }

      // Store in database
      const stored = await db.query(`
        INSERT INTO extracted_knowledge 
        (source_id, source_type, category, problem, solution, confidence, applied_to_sop, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        uuidv4(),
        'manual',
        result.category,
        result.problem,
        result.solution,
        result.confidence,
        false,
        { 
          originalEntry: entry,
          createdBy: 'manual_entry',
          timestamp: new Date().toISOString()
        }
      ]);

      logger.info('Manual knowledge entry processed', {
        category: result.category,
        confidence: result.confidence,
        id: stored.rows[0].id
      });

      return stored.rows[0];
      
    } catch (error) {
      logger.error('Failed to process manual entry:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const knowledgeExtractor = new KnowledgeExtractorService();