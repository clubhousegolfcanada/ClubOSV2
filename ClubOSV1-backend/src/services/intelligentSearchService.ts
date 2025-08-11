import { logger } from '../utils/logger';

/**
 * Intelligent Search Service
 * Understands context, synonyms, and different ways people ask questions
 */
export class IntelligentSearchService {
  // Common synonyms and related terms
  private synonymMap: Record<string, string[]> = {
    // Gift card variations
    'giftcard': ['gift card', 'gift-card', 'giftcards', 'gift cards', 'gift certificate', 'gift voucher', 'voucher', 'certificate', 'present card', 'gift credit'],
    'gift': ['present', 'voucher', 'certificate'],
    'card': ['cards', 'voucher', 'certificate', 'credit'],
    
    // Purchase/buy variations
    'buy': ['purchase', 'get', 'acquire', 'obtain', 'order', 'want'],
    'sell': ['offer', 'have', 'provide', 'stock', 'carry', 'available'],
    
    // Booking variations
    'book': ['reserve', 'schedule', 'appointment', 'reservation', 'booking', 'slot'],
    'cancel': ['cancellation', 'refund', 'reschedule', 'change', 'modify'],
    
    // Time variations
    'hours': ['open', 'closed', 'opening', 'closing', 'schedule', 'times'],
    'today': ['now', 'current', 'currently', 'right now', 'at the moment'],
    
    // Equipment variations
    'simulator': ['sim', 'trackman', 'machine', 'bay', 'station', 'booth'],
    'broken': ['not working', 'issue', 'problem', 'malfunction', 'error', 'broken down', 'faulty'],
    
    // Membership variations
    'member': ['membership', 'vip', 'subscriber', 'regular', 'customer'],
    'discount': ['deal', 'promotion', 'special', 'offer', 'sale', 'reduced'],
    
    // Location variations
    'location': ['address', 'where', 'located', 'find us', 'directions'],
    'parking': ['park', 'lot', 'garage', 'spaces'],
    
    // Payment variations
    'pay': ['payment', 'cost', 'price', 'charge', 'fee', 'rates'],
    'credit card': ['card', 'visa', 'mastercard', 'amex', 'debit'],
  };

  // Question pattern recognition
  private questionPatterns = {
    availability: [
      /do you (have|sell|offer|stock)/i,
      /can i (get|buy|purchase)/i,
      /are .* available/i,
      /is there .* available/i,
      /where can i (get|buy|find)/i,
    ],
    howTo: [
      /how (do|can|to)/i,
      /what is the (process|procedure)/i,
      /steps to/i,
      /instructions for/i,
    ],
    pricing: [
      /how much/i,
      /what.*(cost|price)/i,
      /pricing for/i,
      /rates for/i,
    ],
    location: [
      /where is/i,
      /how to get to/i,
      /directions to/i,
      /located at/i,
    ],
    policy: [
      /what is.*(policy|rule)/i,
      /cancellation policy/i,
      /refund policy/i,
      /terms and conditions/i,
    ],
    technical: [
      /(not working|broken|issue|problem)/i,
      /error/i,
      /how to fix/i,
      /troubleshoot/i,
    ]
  };

  // User context understanding
  private userContextMap = {
    customer: {
      priorities: ['pricing', 'availability', 'howTo', 'location'],
      formalityLevel: 'friendly',
      technicalLevel: 'simple'
    },
    employee: {
      priorities: ['policy', 'technical', 'howTo', 'availability'],
      formalityLevel: 'professional',
      technicalLevel: 'detailed'
    },
    manager: {
      priorities: ['policy', 'technical', 'pricing', 'availability'],
      formalityLevel: 'professional',
      technicalLevel: 'comprehensive'
    }
  };

  /**
   * Expand query with synonyms and related terms
   */
  expandQuery(query: string): string[] {
    const words = query.toLowerCase().split(/\s+/);
    const expandedTerms = new Set<string>();
    
    // Add original query
    expandedTerms.add(query.toLowerCase());
    
    // Add individual words
    words.forEach(word => {
      expandedTerms.add(word);
      
      // Add synonyms for each word
      Object.entries(this.synonymMap).forEach(([key, synonyms]) => {
        if (word.includes(key) || key.includes(word)) {
          synonyms.forEach(syn => expandedTerms.add(syn));
        }
        if (synonyms.some(syn => syn.includes(word) || word.includes(syn))) {
          expandedTerms.add(key);
          synonyms.forEach(syn => expandedTerms.add(syn));
        }
      });
    });
    
    // Check for multi-word synonyms
    Object.entries(this.synonymMap).forEach(([key, synonyms]) => {
      if (query.toLowerCase().includes(key)) {
        synonyms.forEach(syn => expandedTerms.add(syn));
      }
      synonyms.forEach(syn => {
        if (query.toLowerCase().includes(syn)) {
          expandedTerms.add(key);
          synonyms.forEach(s => expandedTerms.add(s));
        }
      });
    });
    
    return Array.from(expandedTerms);
  }

  /**
   * Detect the intent of the query
   */
  detectIntent(query: string): string[] {
    const intents: string[] = [];
    
    Object.entries(this.questionPatterns).forEach(([intent, patterns]) => {
      if (patterns.some(pattern => pattern.test(query))) {
        intents.push(intent);
      }
    });
    
    // If no specific intent detected, analyze keywords
    if (intents.length === 0) {
      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes('gift') || lowerQuery.includes('card')) {
        intents.push('availability', 'pricing');
      }
      if (lowerQuery.includes('book') || lowerQuery.includes('reserve')) {
        intents.push('howTo', 'availability');
      }
      if (lowerQuery.includes('broken') || lowerQuery.includes('issue')) {
        intents.push('technical');
      }
    }
    
    return intents;
  }

  /**
   * Generate search variations based on context
   */
  generateSearchVariations(query: string, userRole?: string): string[] {
    const variations = new Set<string>();
    
    // Add original query
    variations.add(query);
    
    // Expand with synonyms
    const expanded = this.expandQuery(query);
    expanded.forEach(term => variations.add(term));
    
    // Detect intent and add related queries
    const intents = this.detectIntent(query);
    
    // Generate intent-based variations
    if (intents.includes('availability')) {
      variations.add('available');
      variations.add('in stock');
      variations.add('offer');
      variations.add('sell');
      variations.add('have');
    }
    
    if (intents.includes('pricing')) {
      variations.add('cost');
      variations.add('price');
      variations.add('how much');
      variations.add('rates');
      variations.add('fees');
    }
    
    if (intents.includes('howTo')) {
      variations.add('how to');
      variations.add('process');
      variations.add('steps');
      variations.add('procedure');
    }
    
    // Add role-specific variations
    if (userRole) {
      const context = this.userContextMap[userRole as keyof typeof this.userContextMap];
      if (context) {
        // Add priority-based search terms
        context.priorities.forEach(priority => {
          if (intents.includes(priority)) {
            // Boost relevance for user's priority areas
            variations.add(priority);
          }
        });
      }
    }
    
    return Array.from(variations);
  }

  /**
   * Calculate semantic similarity between query and content
   */
  calculateSemanticSimilarity(query: string, content: string): number {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    
    // Direct match
    if (contentLower.includes(queryLower)) {
      return 1.0;
    }
    
    // Check expanded terms
    const expandedTerms = this.expandQuery(query);
    let matchCount = 0;
    let totalTerms = expandedTerms.length;
    
    expandedTerms.forEach(term => {
      if (contentLower.includes(term.toLowerCase())) {
        matchCount++;
      }
    });
    
    // Calculate base similarity
    let similarity = totalTerms > 0 ? matchCount / totalTerms : 0;
    
    // Boost for intent matching
    const intents = this.detectIntent(query);
    const contentIntents = this.detectIntent(content);
    
    const intentOverlap = intents.filter(i => contentIntents.includes(i)).length;
    if (intentOverlap > 0) {
      similarity += 0.2 * (intentOverlap / Math.max(intents.length, 1));
    }
    
    // Boost for key term presence
    const keyTerms = this.extractKeyTerms(query);
    const keyTermMatches = keyTerms.filter(term => 
      contentLower.includes(term.toLowerCase())
    ).length;
    
    if (keyTermMatches > 0) {
      similarity += 0.3 * (keyTermMatches / keyTerms.length);
    }
    
    return Math.min(similarity, 1.0);
  }

  /**
   * Extract key terms from query (non-stop words)
   */
  private extractKeyTerms(query: string): string[] {
    const stopWords = new Set(['do', 'does', 'is', 'are', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'we', 'you', 'i', 'can', 'could', 'would', 'should', 'may', 'might', 'must', 'shall', 'will']);
    
    return query.toLowerCase()
      .replace(/[?!.,;:]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Main search method that combines all intelligence
   */
  intelligentSearch(query: string, userRole?: string): {
    searchTerms: string[];
    expandedQueries: string[];
    intents: string[];
    priority: string;
  } {
    const searchTerms = this.extractKeyTerms(query);
    const expandedQueries = this.generateSearchVariations(query, userRole);
    const intents = this.detectIntent(query);
    
    // Determine priority based on user role and intent
    let priority = 'normal';
    if (userRole) {
      const context = this.userContextMap[userRole as keyof typeof this.userContextMap];
      if (context && intents.length > 0) {
        const topPriority = context.priorities.find(p => intents.includes(p));
        if (topPriority) {
          priority = 'high';
        }
      }
    }
    
    logger.info('Intelligent search analysis', {
      originalQuery: query,
      userRole,
      searchTerms,
      expandedCount: expandedQueries.length,
      intents,
      priority
    });
    
    return {
      searchTerms,
      expandedQueries: Array.from(expandedQueries),
      intents,
      priority
    };
  }
}

// Export singleton instance
export const intelligentSearchService = new IntelligentSearchService();