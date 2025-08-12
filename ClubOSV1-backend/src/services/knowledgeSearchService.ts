import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { intelligentSearchService } from './intelligentSearchService';

interface SearchResult {
  key: string;
  value: any;
  confidence: number;
  relevance: number;
  source: string;
}

export class KnowledgeSearchService {
  /**
   * Search for knowledge across all knowledge tables
   * Priority order:
   * 1. knowledge_store (AI-parsed, searchable)
   * 2. assistant_knowledge (manually uploaded)
   * 3. extracted_knowledge (from conversations)
   */
  async searchKnowledge(
    query: string,
    assistantType?: string,
    limit: number = 5,
    userRole?: string
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      // Use intelligent search to understand query better
      const intelligentAnalysis = intelligentSearchService.intelligentSearch(query, userRole);
      
      // Log the intelligent analysis for debugging
      logger.info('Intelligent search analysis', {
        originalQuery: query,
        expandedQueries: intelligentAnalysis.expandedQueries.slice(0, 5),
        intents: intelligentAnalysis.intents,
        priority: intelligentAnalysis.priority
      });
      
      // Search with expanded queries for better matching
      const searchQueries = [query, ...intelligentAnalysis.expandedQueries.slice(0, 3)];
      
      for (const searchQuery of searchQueries) {
        if (results.length >= limit) break;
        
        // 1. Search knowledge_store with full-text search
        const knowledgeStoreResults = await this.searchKnowledgeStore(searchQuery, assistantType, limit - results.length);
        results.push(...knowledgeStoreResults);
      }

      // DISABLED: Only use knowledge_store for now
      // The other tables have inconsistent confidence scores and poor relevance
      // This was causing wrong results to be prioritized
      /*
      if (results.length < limit) {
        // 2. Search knowledge_audit_log (recent uploads)
        const auditResults = await this.searchKnowledgeAuditLog(query, assistantType, limit - results.length);
        results.push(...auditResults);
      }

      if (results.length < limit) {
        // 3. Search assistant_knowledge
        const assistantResults = await this.searchAssistantKnowledge(query, assistantType, limit - results.length);
        results.push(...assistantResults);
      }

      if (results.length < limit) {
        // 4. Search extracted_knowledge
        const extractedResults = await this.searchExtractedKnowledge(query, limit - results.length);
        results.push(...extractedResults);
      }
      */

      // Sort by relevance and confidence
      results.sort((a, b) => {
        const scoreA = a.relevance * a.confidence;
        const scoreB = b.relevance * b.confidence;
        return scoreB - scoreA;
      });

      // Log search for analytics
      await this.logSearch(query, results.length > 0);

      return results.slice(0, limit);
    } catch (error) {
      logger.error('❌ CRITICAL: Knowledge search failed completely:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        query,
        assistantType
      });
      // Still return empty array but now we'll see the error in logs
      return [];
    }
  }

  /**
   * Search the knowledge_store table using full-text search
   */
  private async searchKnowledgeStore(query: string, assistantType: string | undefined, limit: number): Promise<SearchResult[]> {
    // Don't check db.initialized here - just try the query
    // The database should be initialized by the time any search happens
    try {
      // Build the search query
      const searchQuery = query.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
      
      let sql = `
        SELECT 
          key,
          value,
          confidence,
          ts_rank(search_vector, plainto_tsquery('english', $1)) as relevance
        FROM knowledge_store
        WHERE 
          search_vector @@ plainto_tsquery('english', $1)
          AND superseded_by IS NULL
      `;

      const params: any[] = [searchQuery];

      // Filter by assistant type if provided
      if (assistantType) {
        sql += ` AND (key LIKE $2 || '%' OR value->>'assistant' = $2)`;
        params.push(assistantType.toLowerCase());
      }

      sql += `
        ORDER BY relevance DESC, confidence DESC
        LIMIT $${params.length + 1}
      `;
      params.push(limit);

      const result = await db.query(sql, params);

      return result.rows.map((row: any) => ({
        key: row.key,
        value: row.value,
        confidence: row.confidence || 0.5,
        relevance: row.relevance || 0,
        source: 'knowledge_store'
      }));
    } catch (error) {
      logger.error('Error searching knowledge_store:', error);
      return [];
    }
  }

  /**
   * Search the knowledge_audit_log table (recent uploads)
   */
  private async searchKnowledgeAuditLog(query: string, assistantType: string | undefined, limit: number): Promise<SearchResult[]> {
    // Don't check db.initialized here - just try the query
    try {
      // Common stop words to filter out for better relevance scoring
      const stopWords = new Set(['does', 'do', 'is', 'are', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'we', 'you', 'your', 'them', 'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'offer', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'would', 'could', 'ought', 'may', 'might', 'must', 'shall', 'should', 'would', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);
      
      // Also filter out common business terms that don't add value
      const businessStopWords = new Set(['clubhouse', 'club', 'house', 'golf', 'simulator']);
      
      const searchTerms = query.toLowerCase()
        .replace(/[?!.,;:]/g, '') // Remove punctuation
        .split(' ')
        .filter(term => term.length > 2 && !stopWords.has(term) && !businessStopWords.has(term));
      
      let sql = `
        SELECT 
          action,
          category,
          key,
          new_value,
          assistant_target,
          timestamp
        FROM knowledge_audit_log
        WHERE 1=1
      `;

      const params: any[] = [];

      // Add search conditions
      if (searchTerms.length > 0) {
        const searchConditions = searchTerms.map((_, index) => {
          params.push(`%${searchTerms[index]}%`);
          return `(LOWER(new_value) LIKE $${params.length} OR LOWER(key) LIKE $${params.length} OR LOWER(category) LIKE $${params.length})`;
        });
        sql += ` AND (${searchConditions.join(' OR ')})`;
      }

      // Filter by assistant type
      if (assistantType) {
        const assistantMap: Record<string, string> = {
          'emergency': 'emergency',
          'booking': 'booking',
          'booking & access': 'booking',
          'techsupport': 'tech',
          'tech': 'tech',
          'brandtone': 'brand',
          'brand': 'brand'
        };
        const mappedType = assistantMap[assistantType.toLowerCase()] || assistantType;
        params.push(mappedType);
        sql += ` AND assistant_target = $${params.length}`;
      }

      sql += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await db.query(sql, params);

      return result.rows.map((row: any) => {
        // Calculate relevance using both traditional and semantic similarity
        const contentLower = `${row.new_value} ${row.key || ''} ${row.category}`.toLowerCase();
        const matchCount = searchTerms.filter(term => contentLower.includes(term)).length;
        const basicRelevance = searchTerms.length > 0 ? matchCount / searchTerms.length : 0.5;
        
        // Also calculate semantic similarity
        const semanticRelevance = intelligentSearchService.calculateSemanticSimilarity(
          query,
          row.new_value
        );
        
        // Combine both relevance scores (weighted average)
        const relevance = (basicRelevance * 0.4) + (semanticRelevance * 0.6);

        return {
          key: `audit.${row.assistant_target}.${row.category}`,
          value: {
            content: row.new_value,
            category: row.category,
            action: row.action,
            key: row.key
          },
          confidence: 0.9, // High confidence for recent uploads
          relevance,
          source: 'knowledge_audit_log'
        };
      });
    } catch (error) {
      logger.error('Error searching knowledge_audit_log:', error);
      return [];
    }
  }

  /**
   * Search the assistant_knowledge table
   */
  private async searchAssistantKnowledge(query: string, assistantType: string | undefined, limit: number): Promise<SearchResult[]> {
    // Don't check db.initialized here - just try the query
    try {
      // Use same stop word filtering as audit log search
      const stopWords = new Set(['does', 'do', 'is', 'are', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'we', 'you', 'your', 'them', 'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'offer', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'would', 'could', 'ought', 'may', 'might', 'must', 'shall', 'should', 'would', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);
      const businessStopWords = new Set(['clubhouse', 'club', 'house', 'golf', 'simulator']);
      
      const searchTerms = query.toLowerCase()
        .replace(/[?!.,;:]/g, '')
        .split(' ')
        .filter(term => term.length > 2 && !stopWords.has(term) && !businessStopWords.has(term));
      
      let sql = `
        SELECT 
          route,
          knowledge,
          1.0 as confidence
        FROM assistant_knowledge
        WHERE 1=1
      `;

      const params: any[] = [];

      // Add search conditions
      if (searchTerms.length > 0) {
        const searchConditions = searchTerms.map((_, index) => {
          params.push(`%${searchTerms[index]}%`);
          return `LOWER(knowledge::text) LIKE $${params.length}`;
        });
        sql += ` AND (${searchConditions.join(' OR ')})`;
      }

      // Filter by assistant type
      if (assistantType) {
        params.push(assistantType);
        sql += ` AND route = $${params.length}`;
      }

      sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await db.query(sql, params);

      return result.rows.map((row: any) => {
        // Extract content from the knowledge JSON
        const knowledge = row.knowledge || {};
        let content = '';
        
        // Try to extract meaningful content from the knowledge object
        if (typeof knowledge === 'string') {
          content = knowledge;
        } else if (knowledge.automatedResponses) {
          // Extract automated responses
          const responses = Object.values(knowledge.automatedResponses).flat();
          content = responses.map((r: any) => r.response || r).join(' ');
        } else {
          content = JSON.stringify(knowledge);
        }
        
        // Calculate relevance based on how many search terms match
        const contentLower = content.toLowerCase();
        const matchCount = searchTerms.filter(term => contentLower.includes(term)).length;
        const relevance = searchTerms.length > 0 ? matchCount / searchTerms.length : 0.5;

        return {
          key: `${row.route}.assistant_knowledge`,
          value: {
            content,
            knowledge: row.knowledge,
            assistant: row.route
          },
          confidence: 1.0, // Admin-uploaded knowledge has high confidence
          relevance,
          source: 'assistant_knowledge'
        };
      });
    } catch (error) {
      logger.error('Error searching assistant_knowledge:', error);
      return [];
    }
  }

  /**
   * Search the extracted_knowledge table
   */
  private async searchExtractedKnowledge(query: string, limit: number): Promise<SearchResult[]> {
    // Don't check db.initialized here - just try the query
    try {
      // First check if the table exists and what columns it has
      const tableCheck = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'extracted_knowledge'
        LIMIT 1
      `);

      if (tableCheck.rows.length === 0) {
        // Table doesn't exist
        return [];
      }

      // Use same stop word filtering
      const stopWords = new Set(['does', 'do', 'is', 'are', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'we', 'you', 'your', 'them', 'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'offer', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'would', 'could', 'ought', 'may', 'might', 'must', 'shall', 'should', 'would', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);
      const businessStopWords = new Set(['clubhouse', 'club', 'house', 'golf', 'simulator']);
      
      const searchTerms = query.toLowerCase()
        .replace(/[?!.,;:]/g, '')
        .split(' ')
        .filter(term => term.length > 2 && !stopWords.has(term) && !businessStopWords.has(term));
      
      // Use simpler query that works with actual table structure
      let sql = `
        SELECT 
          problem,
          solution,
          confidence,
          category
        FROM extracted_knowledge
        WHERE applied_to_sop = false
      `;

      const params: any[] = [];

      // Add search conditions
      if (searchTerms.length > 0) {
        const searchConditions = searchTerms.map((_, index) => {
          params.push(`%${searchTerms[index]}%`);
          return `(LOWER(problem) LIKE $${params.length} OR LOWER(solution) LIKE $${params.length})`;
        });
        sql += ` AND (${searchConditions.join(' OR ')})`;
      }

      sql += ` ORDER BY confidence DESC, created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await db.query(sql, params);

      return result.rows.map((row: any) => {
        // Calculate relevance
        const contentLower = `${row.problem} ${row.solution}`.toLowerCase();
        const matchCount = searchTerms.filter(term => contentLower.includes(term)).length;
        const relevance = searchTerms.length > 0 ? matchCount / searchTerms.length : 0.3;

        return {
          key: `extracted.${row.category || 'general'}`,
          value: {
            problem: row.problem,
            solution: row.solution,
            content: row.solution
          },
          confidence: row.confidence || 0.5,
          relevance,
          source: 'extracted_knowledge'
        };
      });
    } catch (error) {
      logger.error('Error searching extracted_knowledge:', error);
      return [];
    }
  }

  /**
   * Get knowledge by exact key
   */
  async getKnowledgeByKey(key: string): Promise<SearchResult | null> {
    if (!db.initialized) return null;

    try {
      const result = await db.query(`
        SELECT key, value, confidence
        FROM knowledge_store
        WHERE key = $1 AND superseded_by IS NULL
        LIMIT 1
      `, [key]);

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        key: row.key,
        value: row.value,
        confidence: row.confidence || 1.0,
        relevance: 1.0, // Exact match
        source: 'knowledge_store'
      };
    } catch (error) {
      logger.error('Error getting knowledge by key:', error);
      return null;
    }
  }

  /**
   * Format search results for assistant response
   */
  formatResultsForResponse(results: SearchResult[]): string {
    if (results.length === 0) return '';

    const highConfidenceResults = results.filter(r => r.confidence >= 0.7);
    if (highConfidenceResults.length === 0) return '';

    // Deduplicate and clean up results
    const seenContent = new Set<string>();
    const uniqueResults: string[] = [];
    
    for (const result of highConfidenceResults.slice(0, 5)) {
      let content = result.value.content || result.value.answer || result.value;
      
      // Clean up content
      if (typeof content === 'string') {
        // Fix common issues
        content = content
          .replace(/\bYou\b(?=\s+(on|at|through))/g, 'them') // Fix "You on our website" -> "them on our website"
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        // Create a normalized version for deduplication (lowercase, no punctuation)
        const normalized = content.toLowerCase().replace(/[^\w\s]/g, '').trim();
        
        // Skip if we've seen very similar content
        const isDuplicate = Array.from(seenContent).some(seen => {
          const similarity = this.calculateStringSimilarity(normalized, seen);
          return similarity > 0.8; // 80% similar = duplicate
        });
        
        if (!isDuplicate && content.length > 20) { // Skip very short snippets
          seenContent.add(normalized);
          uniqueResults.push(content);
        }
      }
    }
    
    // If we have multiple results, pick the best one or combine intelligently
    if (uniqueResults.length === 0) return '';
    
    // For gift cards, use the most concise, clear response
    if (uniqueResults.some(r => r.toLowerCase().includes('gift'))) {
      // Find the result with the URL (most actionable)
      const withUrl = uniqueResults.find(r => r.includes('clubhouse247golf.com'));
      if (withUrl) {
        return `Yes, we offer gift cards! You can purchase them online at ${this.extractUrl(withUrl)}`;
      }
    }
    
    // For single result, return as-is
    if (uniqueResults.length === 1) {
      return uniqueResults[0];
    }
    
    // For multiple unique results, combine them intelligently
    // Start with the most comprehensive one (usually the longest)
    const primary = uniqueResults.sort((a, b) => b.length - a.length)[0];
    
    // Add any unique information from other results
    const additionalInfo = uniqueResults.slice(1)
      .map(r => this.extractUniqueInfo(r, primary))
      .filter(info => info.length > 0);
    
    if (additionalInfo.length > 0) {
      return `${primary}\n\nAdditional information: ${additionalInfo.join('. ')}`;
    }
    
    return primary;
  }
  
  /**
   * Calculate string similarity (simple Levenshtein-based)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Extract URL from text
   */
  private extractUrl(text: string): string {
    const urlMatch = text.match(/(?:www\.|https?:\/\/)?clubhouse247golf\.com[^\s]*/i);
    if (urlMatch) {
      let url = urlMatch[0];
      // Ensure it starts with https://
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
      return url;
    }
    return 'https://clubhouse247golf.com/giftcard/purchase';
  }
  
  /**
   * Extract unique information from a result that's not in the primary result
   */
  private extractUniqueInfo(result: string, primary: string): string {
    const primaryLower = primary.toLowerCase();
    const words = result.split(/\s+/);
    
    // Look for unique facts not in primary
    const uniqueFacts: string[] = [];
    
    // Check for expiry information
    if (result.toLowerCase().includes('expir') && !primaryLower.includes('expir')) {
      const expiryMatch = result.match(/[^.]*expir[^.]*/i);
      if (expiryMatch) uniqueFacts.push(expiryMatch[0].trim());
    }
    
    // Check for digital/physical distinction
    if (result.toLowerCase().includes('digital') && !primaryLower.includes('digital')) {
      uniqueFacts.push('Digital gift cards available');
    }
    
    return uniqueFacts.join('. ');
  }

  /**
   * Log search for analytics
   */
  private async logSearch(query: string, found: boolean): Promise<void> {
    try {
      // Check if knowledge_patterns table exists
      const tableExists = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'knowledge_patterns'
        )
      `);

      if (tableExists.rows[0]?.exists) {
        // Update or insert pattern tracking
        await db.query(`
          INSERT INTO knowledge_patterns (pattern, pattern_type, occurrence_count)
          VALUES ($1, 'search', 1)
          ON CONFLICT (pattern) DO UPDATE SET
            occurrence_count = knowledge_patterns.occurrence_count + 1,
            last_seen = NOW()
        `, [query.substring(0, 255)]);
      }
    } catch (error) {
      // Don't fail the search if logging fails
      logger.error('Error logging search:', error);
    }
  }

  /**
   * Update usage statistics when knowledge is used
   */
  async trackUsage(key: string, successful: boolean): Promise<void> {
    if (!db.initialized) return;

    try {
      const column = successful ? 'success_count' : 'failure_count';
      await db.query(`
        UPDATE knowledge_store
        SET 
          usage_count = usage_count + 1,
          ${column} = ${column} + 1,
          last_accessed = NOW()
        WHERE key = $1
      `, [key]);
    } catch (error) {
      logger.error('Error tracking usage:', error);
    }
  }
}

// Export singleton instance
export const knowledgeSearchService = new KnowledgeSearchService();