import { OpenAI } from 'openai';
import { logger } from '../utils/logger';
import { query } from '../utils/db';

interface SearchIntent {
  originalQuery: string;
  searchTerms: string[];
  categories: string[];
  expandedQueries: string[];
}

interface SearchResult {
  id: string;
  assistant: string;
  title: string;
  content: string;
  relevance: number;
  matchedTerms: string[];
}

export class IntelligentSearchService {
  private openai: OpenAI | null = null;
  
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }
  
  /**
   * Use GPT-4o to understand search intent and generate variations
   */
  async analyzeSearchIntent(query: string): Promise<SearchIntent> {
    if (!this.openai) {
      // Fallback to basic search
      return {
        originalQuery: query,
        searchTerms: [query],
        categories: ['brand', 'tech', 'booking', 'emergency'],
        expandedQueries: [query]
      };
    }
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a search query analyzer for a golf simulator business knowledge base. 
            The knowledge base contains diverse information including:
            - Technical installation and troubleshooting guides
            - Booking system procedures and issues
            - Competitor information (e.g., 7-iron, Better Golf, etc.)
            - Brand guidelines, color codes, logos
            - Emergency procedures
            - Business relationships and contacts
            - Hardware specifications
            - Customer service scripts
            
            Analyze the user's query and generate search variations. For business names:
            - "7iron" could be written as "7-iron", "7 iron", "seven iron"
            - "BetterGolf" could be "Better Golf", "better golf"
            - Consider both as product names AND competitor business names
            
            Categories available: brand (competitors, branding, relationships), tech (hardware, software, troubleshooting), booking (reservations, access), emergency
            
            Return a JSON object with:
            {
              "searchTerms": ["exact terms to search for, including variations"],
              "categories": ["most relevant categories - can be multiple"],
              "expandedQueries": ["alternative phrasings, synonyms, related searches"]
            }`
          },
          {
            role: 'user',
            content: `Analyze this search query: "${query}"`
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });
      
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        originalQuery: query,
        searchTerms: analysis.searchTerms || [query],
        categories: analysis.categories || ['brand', 'tech', 'booking', 'emergency'],
        expandedQueries: analysis.expandedQueries || [query]
      };
      
    } catch (error) {
      logger.error('Failed to analyze search intent:', error);
      return {
        originalQuery: query,
        searchTerms: [query],
        categories: ['brand', 'tech', 'booking', 'emergency'],
        expandedQueries: [query]
      };
    }
  }
  
  /**
   * Search across all SOP embeddings intelligently
   */
  async intelligentSearch(
    userQuery: string,
    preferredCategory?: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    logger.info('Starting intelligent search:', { userQuery, preferredCategory });
    
    // Analyze search intent
    const intent = await this.analyzeSearchIntent(userQuery);
    logger.info('Search intent analyzed:', intent);
    
    // Build search query with multiple conditions
    const searchConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    // Add search terms
    for (const term of intent.searchTerms) {
      searchConditions.push(`(
        lower(content) LIKE lower($${paramIndex})
        OR lower(title) LIKE lower($${paramIndex})
        OR to_tsvector('english', content) @@ plainto_tsquery('english', $${paramIndex + 1})
      )`);
      params.push(`%${term}%`, term);
      paramIndex += 2;
    }
    
    // Add expanded queries
    for (const expanded of intent.expandedQueries) {
      searchConditions.push(`(
        lower(content) LIKE lower($${paramIndex})
        OR to_tsvector('english', content) @@ plainto_tsquery('english', $${paramIndex + 1})
      )`);
      params.push(`%${expanded}%`, expanded);
      paramIndex += 2;
    }
    
    // Build the full query
    let sqlQuery = `
      WITH search_results AS (
        SELECT 
          id,
          assistant,
          title,
          content,
          metadata,
          GREATEST(
    `;
    
    // Calculate relevance score based on matches
    const relevanceCalculations: string[] = [];
    let scoreIndex = 1;
    for (const term of [...intent.searchTerms, ...intent.expandedQueries]) {
      relevanceCalculations.push(`
        CASE 
          WHEN lower(title) LIKE lower($${scoreIndex}) THEN 0.8
          WHEN lower(content) LIKE lower($${scoreIndex}) THEN 0.5
          ELSE 0
        END
      `);
      scoreIndex += 2; // Skip the tsquery param
    }
    
    sqlQuery += relevanceCalculations.join(' + ') + `) as relevance,
          ARRAY_REMOVE(ARRAY[`;
    
    // Track which terms matched
    const matchTracking: string[] = [];
    let matchIndex = 1;
    for (const term of intent.searchTerms) {
      matchTracking.push(`
        CASE WHEN lower(content) LIKE lower($${matchIndex}) OR lower(title) LIKE lower($${matchIndex}) 
        THEN '${term}' ELSE NULL END
      `);
      matchIndex += 2;
    }
    
    sqlQuery += matchTracking.join(', ') + `], NULL) as matched_terms
        FROM sop_embeddings
        WHERE (${searchConditions.join(' OR ')})
    `;
    
    // Filter by categories if specified
    if (preferredCategory) {
      sqlQuery += ` AND assistant = $${paramIndex}`;
      params.push(preferredCategory);
      paramIndex++;
    } else if (intent.categories.length < 4) {
      sqlQuery += ` AND assistant = ANY($${paramIndex}::text[])`;
      params.push(intent.categories);
      paramIndex++;
    }
    
    sqlQuery += `
      )
      SELECT * FROM search_results
      WHERE relevance > 0
      ORDER BY relevance DESC, title
      LIMIT $${paramIndex}
    `;
    params.push(limit);
    
    try {
      const result = await query(sqlQuery, params);
      
      logger.info(`Intelligent search completed in ${Date.now() - startTime}ms, found ${result.rows.length} results`);
      
      return result.rows.map(row => ({
        id: row.id,
        assistant: row.assistant,
        title: row.title,
        content: row.content,
        relevance: parseFloat(row.relevance),
        matchedTerms: row.matched_terms || []
      }));
      
    } catch (error) {
      logger.error('Intelligent search failed:', error);
      
      // Fallback to simple search
      const fallbackResult = await query(`
        SELECT id, assistant, title, content, 0.5 as relevance
        FROM sop_embeddings
        WHERE content ILIKE $1 OR title ILIKE $1
        LIMIT $2
      `, [`%${userQuery}%`, limit]);
      
      return fallbackResult.rows.map(row => ({
        ...row,
        matchedTerms: [userQuery]
      }));
    }
  }
  
  /**
   * Use GPT-4o to synthesize search results into a coherent response
   */
  async synthesizeResponse(
    userQuery: string,
    searchResults: SearchResult[]
  ): Promise<string> {
    if (!this.openai || searchResults.length === 0) {
      return '';
    }
    
    try {
      // Prepare context from search results
      const context = searchResults.map(result => 
        `[${result.title}]\n${result.content.substring(0, 500)}...`
      ).join('\n\n---\n\n');
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant for a golf simulator business. 
            Use the provided context to answer the user's question accurately and concisely.
            If the information is not in the context, say so clearly.
            Format your response as clear, actionable information.`
          },
          {
            role: 'user',
            content: `Question: ${userQuery}\n\nContext:\n${context}`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      });
      
      return response.choices[0].message.content || '';
      
    } catch (error) {
      logger.error('Failed to synthesize response:', error);
      return '';
    }
  }
}

export const intelligentSearch = new IntelligentSearchService();