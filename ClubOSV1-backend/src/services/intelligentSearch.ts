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
            content: `You are a context-aware search query analyzer. The AI must understand INTENT and CONTEXT, not just keywords.
            
            CONTEXT UNDERSTANDING RULES:
            1. If user asks about "problems" → search for issues, troubleshooting, errors, failures, bugs
            2. If user asks about "setup" → search for installation, configuration, initialization, deployment
            3. If user asks about "competition" → search for ALL competitors: 7-iron, Better Golf, any facilities
            4. If user asks about "colors" → search for brand guidelines, hex codes, RGB values, design standards
            5. If user asks about "contact" → search for people names, emails, phone numbers, relationships
            6. If user asks about "how to" → search for procedures, SOPs, guides, instructions
            7. If user asks about "cost/price" → search for pricing, fees, rates, subscriptions, payments
            8. If user asks about hardware → search for model numbers, specs, equipment, devices
            
            EXPAND SEARCHES INTELLIGENTLY:
            - "WiFi issues" → also search: network, internet, connectivity, UniFi, router, access point
            - "booking problem" → also search: reservation, schedule, calendar, availability, access
            - "projector" → also search: BenQ, display, screen, image quality, calibration
            - "7iron" → search ALL variations: "7-iron", "7 iron", "seven iron", "7iron facility"
            - "logo" → also search: brand, branding, colors, hex code, design, guidelines
            
            Categories: brand, tech, booking, emergency (search ALL if context unclear)
            
            Return JSON with COMPREHENSIVE search coverage:
            {
              "searchTerms": ["ALL variations and related terms that could contain the answer"],
              "categories": ["ALL categories that might have relevant info"],
              "expandedQueries": ["conceptually related searches that provide context"]
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
      // Check both old assistant field and new categories array
      sqlQuery += ` AND (assistant = $${paramIndex} OR $${paramIndex} = ANY(categories))`;
      params.push(preferredCategory);
      paramIndex++;
    } else if (intent.categories.length < 4) {
      // Check if any of the intent categories match
      sqlQuery += ` AND (assistant = ANY($${paramIndex}::text[]) OR categories && $${paramIndex}::text[])`;
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