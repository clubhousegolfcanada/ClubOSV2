import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

export class SemanticSearchService {
  private openai: OpenAI | null = null;
  
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }
  
  /**
   * Search all extracted knowledge using semantic understanding
   * This uses OpenAI to understand the query and find relevant documents
   */
  async searchKnowledge(query: string, options: {
    limit?: number;
    minRelevance?: number;
    includeAllCategories?: boolean;
  } = {}) {
    const { limit = 10, minRelevance = 0.5, includeAllCategories = true } = options;
    
    if (!this.openai) {
      logger.warn('OpenAI not configured, falling back to keyword search');
      return this.fallbackSearch(query, limit);
    }
    
    try {
      // Step 1: Get all documents from database
      const documents = await db.query(`
        SELECT id, category, problem, solution, confidence
        FROM extracted_knowledge
        WHERE confidence >= 0.6
        ${includeAllCategories ? '' : 'AND category = $1'}
        ORDER BY confidence DESC
        LIMIT 500
      `, includeAllCategories ? [] : [options.category]);
      
      if (documents.rows.length === 0) {
        logger.info('No documents found in extracted knowledge');
        return [];
      }
      
      // Step 2: Use GPT to analyze the query and rank documents
      const prompt = `You are a knowledge search system. A user is asking: "${query}"
      
      Here are the available knowledge entries. For each entry, rate how relevant it is to the user's question on a scale of 0-1.
      Return a JSON array with only the relevant entries (relevance > ${minRelevance}), sorted by relevance.
      
      Available knowledge:
      ${documents.rows.map((doc, idx) => `
      ID: ${idx}
      Category: ${doc.category}
      Problem: ${doc.problem}
      Solution: ${doc.solution}
      `).join('\n---\n')}
      
      Return JSON in this format:
      [
        {
          "index": 0,
          "relevance": 0.95,
          "reasoning": "This directly answers the user's question about..."
        }
      ]
      
      Only include entries with relevance > ${minRelevance}. Maximum ${limit} results.`;
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a precise knowledge search system. Analyze queries and match them with relevant knowledge.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2000
      });
      
      const rankings = JSON.parse(response.choices[0].message.content || '[]');
      
      // Step 3: Return the ranked documents
      const results = rankings
        .filter((r: any) => r.relevance > minRelevance)
        .sort((a: any, b: any) => b.relevance - a.relevance)
        .slice(0, limit)
        .map((r: any) => ({
          ...documents.rows[r.index],
          relevance: r.relevance,
          reasoning: r.reasoning,
          source: 'semantic_search'
        }));
      
      logger.info('Semantic search results:', {
        query,
        documentsSearched: documents.rows.length,
        relevantFound: results.length
      });
      
      return results;
      
    } catch (error) {
      logger.error('Semantic search failed:', error);
      return this.fallbackSearch(query, limit);
    }
  }
  
  /**
   * Simpler approach: Generate an embedding for the query and compare with stored embeddings
   */
  async embeddingSearch(query: string, options: {
    limit?: number;
    category?: string;
  } = {}) {
    const { limit = 10, category } = options;
    
    if (!this.openai) {
      return this.fallbackSearch(query, limit);
    }
    
    try {
      // Generate embedding for the query
      const embeddingResponse = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: query
      });
      
      const queryEmbedding = embeddingResponse.data[0].embedding;
      
      // For now, since we don't have embeddings stored, use the semantic search
      return this.searchKnowledge(query, { limit, includeAllCategories: !category });
      
    } catch (error) {
      logger.error('Embedding search failed:', error);
      return this.fallbackSearch(query, limit);
    }
  }
  
  /**
   * Fallback to simple keyword search
   */
  private async fallbackSearch(query: string, limit: number) {
    try {
      const result = await db.query(`
        SELECT id, category, problem, solution, confidence
        FROM extracted_knowledge
        WHERE problem ILIKE $1 OR solution ILIKE $1
        ORDER BY confidence DESC
        LIMIT $2
      `, [`%${query}%`, limit]);
      
      return result.rows.map(r => ({
        ...r,
        relevance: 0.7,
        source: 'keyword_fallback'
      }));
    } catch (error) {
      logger.error('Fallback search failed:', error);
      return [];
    }
  }
  
  /**
   * Use GPT to generate a comprehensive answer using found knowledge
   */
  async generateAnswer(query: string, knowledge: any[]) {
    if (!this.openai || knowledge.length === 0) {
      return null;
    }
    
    try {
      const prompt = `You are a helpful assistant for a golf simulator facility. 
      
      User Question: ${query}
      
      Available Knowledge:
      ${knowledge.map(k => `
      Problem: ${k.problem}
      Solution: ${k.solution}
      Category: ${k.category}
      ---`).join('\n')}
      
      Using the above knowledge, provide a comprehensive answer to the user's question.
      If multiple pieces of knowledge are relevant, synthesize them into a cohesive response.
      Be conversational and helpful.`;
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a knowledgeable assistant for Clubhouse 24/7 Golf.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
      
      return response.choices[0].message.content;
      
    } catch (error) {
      logger.error('Failed to generate answer:', error);
      return null;
    }
  }
}

export const semanticSearch = new SemanticSearchService();