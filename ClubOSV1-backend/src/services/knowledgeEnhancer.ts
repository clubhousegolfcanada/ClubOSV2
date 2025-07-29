import { OpenAI } from 'openai';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

interface EnhancedDocument {
  id: string;
  title: string;
  content: string;
  metadata: {
    type: string;
    entities: string[];
    tags: string[];
    companies?: string[];
    people?: string[];
    topics: string[];
    originalTitle?: string;
  };
}

export class KnowledgeEnhancerService {
  private openai: OpenAI | null = null;
  
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }
  
  /**
   * Enhance existing documents with better structure
   */
  async enhanceExistingDocuments(batchSize: number = 10): Promise<void> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }
    
    logger.info('Starting document enhancement...');
    
    // Get documents that need enhancement
    const result = await db.query(`
      SELECT id, assistant, title, content, metadata
      FROM sop_embeddings
      WHERE metadata->>'enhanced' IS NULL
      OR metadata->>'enhanced' = 'false'
      ORDER BY created_at DESC
      LIMIT $1
    `, [batchSize]);
    
    logger.info(`Found ${result.rows.length} documents to enhance`);
    
    for (const doc of result.rows) {
      try {
        const enhanced = await this.enhanceDocument(doc);
        await this.updateDocument(enhanced);
        logger.info(`Enhanced document: ${enhanced.title}`);
      } catch (error) {
        logger.error(`Failed to enhance document ${doc.id}:`, error);
      }
    }
  }
  
  /**
   * Enhance a single document
   */
  private async enhanceDocument(doc: any): Promise<EnhancedDocument> {
    const prompt = `Analyze this knowledge base entry and create a better structure:

Current Title: ${doc.title}
Category: ${doc.assistant}
Content: ${doc.content}

Create an enhanced version with:
1. A descriptive, searchable title
2. Identify the type (competitor-info, troubleshooting, procedure, contact-info, etc.)
3. Extract all entities (company names, people, products)
4. Generate relevant search tags
5. Identify key topics

Return JSON:
{
  "title": "Clear, descriptive title",
  "type": "competitor-info|troubleshooting|procedure|contact-info|etc",
  "entities": ["all named entities found"],
  "companies": ["company names if any"],
  "people": ["person names if any"],
  "tags": ["searchable", "keywords", "concepts"],
  "topics": ["main topics covered"]
}`;

    const response = await this.openai!.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are enhancing a knowledge base for a golf simulator business. Extract structured data to improve searchability.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });
    
    const enhancement = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      id: doc.id,
      title: enhancement.title || doc.title,
      content: doc.content,
      metadata: {
        ...doc.metadata,
        type: enhancement.type || 'general',
        entities: enhancement.entities || [],
        tags: enhancement.tags || [],
        companies: enhancement.companies,
        people: enhancement.people,
        topics: enhancement.topics || [],
        originalTitle: doc.title,
        enhanced: true,
        enhancedAt: new Date().toISOString()
      }
    };
  }
  
  /**
   * Update document in database
   */
  private async updateDocument(doc: EnhancedDocument): Promise<void> {
    await db.query(`
      UPDATE sop_embeddings
      SET title = $1,
          metadata = $2,
          updated_at = NOW()
      WHERE id = $3
    `, [doc.title, JSON.stringify(doc.metadata), doc.id]);
  }
  
  /**
   * Generate embeddings for better semantic search
   */
  async generateProperEmbeddings(batchSize: number = 20): Promise<void> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }
    
    // Get documents without proper embeddings
    const result = await db.query(`
      SELECT id, title, content
      FROM sop_embeddings
      WHERE embedding IS NULL
      OR jsonb_array_length(embedding::jsonb) = 0
      LIMIT $1
    `, [batchSize]);
    
    logger.info(`Generating embeddings for ${result.rows.length} documents`);
    
    for (const doc of result.rows) {
      try {
        // Create searchable text combining title and content
        const searchableText = `${doc.title}\n\n${doc.content}`.slice(0, 8000);
        
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: searchableText
        });
        
        const embedding = response.data[0].embedding;
        
        // Store as proper array, not JSON string
        await db.query(`
          UPDATE sop_embeddings
          SET embedding = $1
          WHERE id = $2
        `, [JSON.stringify(embedding), doc.id]);
        
        logger.info(`Generated embedding for: ${doc.title}`);
      } catch (error) {
        logger.error(`Failed to generate embedding for ${doc.id}:`, error);
      }
    }
  }
  
  /**
   * Create database indexes for better search
   */
  async optimizeDatabase(): Promise<void> {
    logger.info('Optimizing database for better search...');
    
    const optimizations = [
      // GIN index for full-text search
      `CREATE INDEX IF NOT EXISTS idx_sop_content_search 
       ON sop_embeddings USING gin(to_tsvector('english', title || ' ' || content))`,
      
      // Index for metadata searches
      `CREATE INDEX IF NOT EXISTS idx_sop_metadata 
       ON sop_embeddings USING gin(metadata)`,
      
      // Index for category filtering
      `CREATE INDEX IF NOT EXISTS idx_sop_assistant 
       ON sop_embeddings(assistant)`,
      
      // Trigram index for fuzzy matching (handles "Better Golf" vs "better golf")
      `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
      `CREATE INDEX IF NOT EXISTS idx_sop_title_trgm 
       ON sop_embeddings USING gin(title gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS idx_sop_content_trgm 
       ON sop_embeddings USING gin(content gin_trgm_ops)`
    ];
    
    for (const query of optimizations) {
      try {
        await db.query(query);
        logger.info(`Executed: ${query.split('\n')[0]}...`);
      } catch (error) {
        logger.warn(`Optimization query failed:`, error);
      }
    }
  }
  
  /**
   * Get enhancement progress
   */
  async getProgress(): Promise<any> {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN metadata->>'enhanced' = 'true' THEN 1 END) as enhanced,
        COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as has_embeddings
      FROM sop_embeddings
    `);
    
    return result.rows[0];
  }
}

export const knowledgeEnhancer = new KnowledgeEnhancerService();