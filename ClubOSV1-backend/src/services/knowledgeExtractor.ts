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
  async processManualEntry(entry: string, clearExisting: boolean = false): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    try {
      // Detect if this is a bulk import (markdown, JSON, or multi-line)
      const isBulkImport = this.detectBulkImport(entry);
      
      if (isBulkImport) {
        return await this.processBulkImport(entry, clearExisting);
      } else {
        return await this.processSingleEntry(entry);
      }
    } catch (error) {
      logger.error('Failed to process manual entry:', error);
      throw error;
    }
  }

  /**
   * Detect if the entry is a bulk import
   */
  private detectBulkImport(entry: string): boolean {
    // Check for markdown headers
    if (entry.includes('###') || entry.includes('##') || entry.includes('#')) {
      return true;
    }
    
    // Check for JSON structure
    if (entry.trim().startsWith('{') || entry.trim().startsWith('[')) {
      try {
        JSON.parse(entry);
        return true;
      } catch {
        // Not valid JSON
      }
    }
    
    // Check for multiple substantial lines (bulk text)
    const lines = entry.split('\n').filter(line => line.trim().length > 10);
    if (lines.length > 3) {
      return true;
    }
    
    return false;
  }

  /**
   * Process a single knowledge entry
   */
  private async processSingleEntry(entry: string): Promise<any> {
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

    const response = await this.openai!.chat.completions.create({
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
  }

  /**
   * Process bulk import of knowledge directly into SOP embeddings
   */
  private async processBulkImport(entry: string, clearExisting: boolean = false): Promise<any> {
    logger.info('Processing bulk import into SOP embeddings...');
    
    const prompt = `Analyze this OpenAI assistant document and determine which assistant category it belongs to, then structure it for our SOP system.

Document:
${entry}

First, determine the assistant category based on content:
- "emergency": Emergency procedures, safety protocols, escalation contacts
- "booking": Booking procedures, access control, refunds, memberships  
- "tech": Technical troubleshooting, hardware issues, simulator problems
- "brand": Brand guidelines, marketing, customer tone, company information

Then extract knowledge sections with clear titles and content. Preserve the document structure but break into logical sections.

Return a JSON object with:
{
  "assistant": "emergency|booking|tech|brand",
  "sections": [
    {
      "title": "Clear section title",
      "content": "Complete section content with all details preserved",
      "confidence": 0.95
    },
    ...
  ],
  "summary": "Brief summary of the document imported"
}`;

    const response = await this.openai!.chat.completions.create({
      model: this.MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are importing OpenAI assistant documents into a golf simulator SOP system. Preserve all content accurately and categorize correctly to match existing assistant routing.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    if (!result.assistant || !result.sections || !Array.isArray(result.sections)) {
      throw new Error('Invalid bulk import response format');
    }

    // Validate assistant category matches our routing
    const validAssistant = ['emergency', 'booking', 'tech', 'brand'].includes(result.assistant);
    if (!validAssistant) {
      throw new Error(`Invalid assistant category: ${result.assistant}`);
    }

    const imported = [];
    
    // Clear existing embeddings for this assistant if requested
    if (clearExisting) {
      logger.info(`Clearing existing embeddings for assistant: ${result.assistant}`);
      await db.query('DELETE FROM sop_embeddings WHERE assistant = $1', [result.assistant]);
    }
    
    // Import the sections into SOP embeddings - import the intelligent SOP module for embedding generation
    const { intelligentSOPModule } = await import('./intelligentSOPModule');
  
    // Process each section
    for (const section of result.sections) {
      if (!section.title || !section.content) {
        logger.warn('Skipping invalid section:', section);
        continue;
      }

      try {
        // Generate embedding for the content
        const embeddingResponse = await this.openai!.embeddings.create({
          model: 'text-embedding-3-small',
          input: section.content.slice(0, 8000)
        });
        
        const embedding = embeddingResponse.data[0].embedding;
        
        // Create unique ID for this section
        const sectionId = `imported_${result.assistant}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Check for duplicates by title and assistant
        const existing = await db.query(`
          SELECT id FROM sop_embeddings
          WHERE assistant = $1 AND title ILIKE $2
          LIMIT 1
        `, [result.assistant, `%${section.title}%`]);

        if (existing.rows.length > 0) {
          logger.info(`Updating existing section: ${section.title}`);
          
          // Update existing
          await db.query(`
            UPDATE sop_embeddings 
            SET content = $1, embedding = $2, updated_at = NOW(),
                metadata = $3
            WHERE id = $4
          `, [
            section.content,
            JSON.stringify(embedding),
            JSON.stringify({
              imported: true,
              importSummary: result.summary,
              confidence: section.confidence || 0.9,
              updatedBy: 'bulk_import',
              timestamp: new Date().toISOString()
            }),
            existing.rows[0].id
          ]);
          
          imported.push({
            id: existing.rows[0].id,
            title: section.title,
            action: 'updated'
          });
        } else {
          // Insert new
          const stored = await db.query(`
            INSERT INTO sop_embeddings 
            (id, assistant, title, content, embedding, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
          `, [
            sectionId,
            result.assistant,
            section.title,
            section.content,
            JSON.stringify(embedding),
            JSON.stringify({
              imported: true,
              importSummary: result.summary,
              confidence: section.confidence || 0.9,
              createdBy: 'bulk_import',
              timestamp: new Date().toISOString()
            })
          ]);

          imported.push({
            ...stored.rows[0],
            action: 'created'
          });
        }
        
        logger.info(`Imported section: ${section.title} -> ${result.assistant}`);
        
      } catch (error) {
        logger.error('Failed to import section:', error);
      }
    }

    // Refresh the intelligent SOP module cache to include new data
    try {
      intelligentSOPModule.refreshDocumentCache();
      logger.info('SOP module cache refreshed');
    } catch (error) {
      logger.warn('Failed to refresh SOP cache:', error);
    }

    logger.info(`Bulk import completed: ${imported.length} sections imported into ${result.assistant} assistant`);

    return {
      imported: imported.length,
      assistant: result.assistant,
      summary: result.summary,
      sections: imported
    };
  }

  /**
   * Preview what the AI will do with the entry without saving
   */
  async previewManualEntry(entry: string): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    try {
      // Detect if this is a bulk import
      const isBulkImport = this.detectBulkImport(entry);
      
      if (!isBulkImport) {
        // For single entries, just return a simple preview
        return {
          isBulkImport: false,
          recommendedCategory: 'general',
          sections: [{
            title: 'Single Knowledge Entry',
            content: entry,
            confidence: 0.8
          }]
        };
      }

      // For bulk imports, analyze and organize the content while preserving exact text
      const prompt = `Parse this document and organize it into sections for our SOP system. PRESERVE THE EXACT ORIGINAL TEXT - do not summarize, interpret, or rewrite anything.

Document:
${entry}

Instructions:
1. Identify which assistant category this content fits: emergency, booking, tech, or brand
2. Split the document into logical sections based on headers, topics, or natural breaks
3. Extract the exact original titles and content - DO NOT rewrite or summarize
4. Keep all specific details, procedures, names, numbers, and exact wording
5. Only organize/split the content, never change the actual text

Return a JSON object with:
{
  "primaryCategory": "emergency|booking|tech|brand",
  "possibleCategories": ["emergency", "booking", "tech", "brand"],
  "sections": [
    {
      "title": "Exact original title or first line",
      "content": "Exact original content with all details preserved",
      "confidence": 0.95
    },
    ...
  ]
}

CRITICAL: The "content" field must contain the exact original text from the document. Do not summarize, paraphrase, or interpret. Preserve all specific information, procedures, contact details, numbers, and exact wording.`;

      const response = await this.openai.chat.completions.create({
        model: this.MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are parsing documents for a golf simulator SOP system. Your ONLY job is to organize content into sections while preserving the exact original text. Never summarize, interpret, or rewrite any content. Extract and preserve the exact wording, numbers, procedures, and details from the original document.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        isBulkImport: true,
        ...result
      };
      
    } catch (error) {
      logger.error('Failed to preview entry:', error);
      throw error;
    }
  }

  /**
   * Process confirmed entry with selected categories
   */
  async processConfirmedEntry(sections: any[], selectedCategories: Record<string, boolean>, clearExisting: boolean = false): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    try {
      const categories = Object.keys(selectedCategories).filter(k => selectedCategories[k]);
      const imported = [];
      
      // Import the sections into SOP embeddings
      const { intelligentSOPModule } = await import('./intelligentSOPModule');
      
      for (const category of categories) {
        // Clear existing embeddings for this assistant if requested
        if (clearExisting) {
          logger.info(`Clearing existing embeddings for assistant: ${category}`);
          await db.query('DELETE FROM sop_embeddings WHERE assistant = $1', [category]);
        }
        
        // Process each section for this category
        for (const section of sections) {
          try {
            // Generate embedding for the content
            const embeddingResponse = await this.openai.embeddings.create({
              model: 'text-embedding-3-small',
              input: section.content.slice(0, 8000)
            });
            
            const embedding = embeddingResponse.data[0].embedding;
            
            // Create unique ID for this section
            const sectionId = `imported_${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Check for duplicates by title and assistant
            const existing = await db.query(`
              SELECT id FROM sop_embeddings
              WHERE assistant = $1 AND title ILIKE $2
              LIMIT 1
            `, [category, `%${section.title}%`]);

            if (existing.rows.length > 0 && !clearExisting) {
              logger.info(`Updating existing section: ${section.title} in ${category}`);
              
              // Update existing
              await db.query(`
                UPDATE sop_embeddings 
                SET content = $1, embedding = $2, updated_at = NOW(),
                    metadata = $3
                WHERE id = $4
              `, [
                section.content,
                JSON.stringify(embedding),
                JSON.stringify({
                  imported: true,
                  multiCategory: true,
                  confidence: section.confidence || 0.9,
                  categories: categories,
                  updatedBy: 'confirmed_import',
                  timestamp: new Date().toISOString()
                }),
                existing.rows[0].id
              ]);
              
              imported.push({
                id: existing.rows[0].id,
                title: section.title,
                category: category,
                action: 'updated'
              });
            } else {
              // Insert new
              const stored = await db.query(`
                INSERT INTO sop_embeddings 
                (id, assistant, title, content, embedding, metadata)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
              `, [
                sectionId,
                category,
                section.title,
                section.content,
                JSON.stringify(embedding),
                JSON.stringify({
                  imported: true,
                  multiCategory: categories.length > 1,
                  confidence: section.confidence || 0.9,
                  categories: categories,
                  createdBy: 'confirmed_import',
                  timestamp: new Date().toISOString()
                })
              ]);

              imported.push({
                ...stored.rows[0],
                category: category,
                action: 'created'
              });
            }
            
            logger.info(`Imported section: ${section.title} -> ${category}`);
            
          } catch (error) {
            logger.error('Failed to import section:', error);
          }
        }
      }

      // Refresh the intelligent SOP module cache
      try {
        await intelligentSOPModule.refreshDocumentCache();
        logger.info('SOP module cache refreshed');
      } catch (error) {
        logger.warn('Failed to refresh SOP cache:', error);
      }

      logger.info(`Confirmed import completed: ${imported.length} sections imported into ${categories.length} categories`);

      return {
        imported: imported.length,
        categories: categories,
        sections: imported,
        summary: `Imported ${sections.length} sections into ${categories.join(', ')} assistants`
      };
      
    } catch (error) {
      logger.error('Failed to process confirmed entry:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const knowledgeExtractor = new KnowledgeExtractorService();