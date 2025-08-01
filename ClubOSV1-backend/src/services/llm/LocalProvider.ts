import { BaseLLMProvider } from './BaseLLMProvider';
import { LLMConfig, LLMResponse } from './types';
import { logger } from '../../utils/logger';
import { knowledgeLoader } from '../../knowledge-base/knowledgeLoader';

/**
 * Enhanced Local/Demo LLM provider that uses knowledge base
 * This provider doesn't require any external API but provides intelligent responses
 */
export class LocalProvider extends BaseLLMProvider {
  private patterns: Map<string, { keywords: string[], confidence: number }>;

  constructor(config: LLMConfig = {}) {
    super(config, 'local');
    
    // Initialize keyword patterns for routing - updated to match new routing rules
    this.patterns = new Map([
      ['Booking & Access', {
        keywords: ['book', 'reservation', 'reserve', 'cancel', 'availability', 'schedule', 'bay', 'time slot', 'refund', 'reschedule', 'unlock', 'door', 'access', 'entry', 'key', 'card', 'permission', 'locked out', 'can\'t enter', 'forgot code', 'payment', 'lost item'],
        confidence: 0.8
      }],
      ['Emergency', {
        keywords: ['emergency', 'fire', 'injury', 'hurt', 'accident', 'help', 'urgent', 'danger', 'alarm', 'power out', 'water leak', 'medical', 'smoke', 'security', 'threat', 'safety'],
        confidence: 0.95
      }],
      ['TechSupport', {
        keywords: ['not working', 'broken', 'error', 'fix', 'technical', 'software', 'hardware', 'simulator', 'screen', 'trackman', 'frozen', 'wifi', 'camera', 'projector', 'how do i use', 'how to use', 'ball', 'tracking', 'sensor', 'calibrat', 'game', 'settings', 'equipment', 'restart', 'reboot', 'issue', 'problem'],
        confidence: 0.8
      }],
      ['BrandTone', {
        keywords: ['membership', 'pricing', 'cost', 'how much', 'promotion', 'discount', 'offer', 'hours', 'gift card', 'loyalty', 'new member', 'sign up'],
        confidence: 0.7
      }]
    ]);
  }

  isConfigured(): boolean {
    // Local provider is always configured
    return true;
  }

  getModel(): string | null {
    return 'local-knowledge-base-v2';
  }

  async testConnection(): Promise<boolean> {
    // Local provider is always connected
    return true;
  }

  async processRequest(
    description: string,
    userId?: string,
    context?: Record<string, any>
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const lowerDescription = description.toLowerCase();
    
    // Use centralized knowledgeLoader for unified search
    const searchResults = await knowledgeLoader.unifiedSearch(description, {
      includeStatic: true,
      includeExtracted: true,
      includeSOPEmbeddings: true,
      limit: 10
    });
    
    logger.debug('Unified knowledge search:', {
      description,
      resultsFound: searchResults.length,
      sources: searchResults.map(r => r.source).filter((v, i, a) => a.indexOf(v) === i)
    });
    
    let bestMatch = {
      route: 'TechSupport' as any, // Default to TechSupport
      score: 0,
      matchedKeywords: [] as string[],
      solution: null as any
    };

    // If we found knowledge matches, use them
    if (searchResults.length > 0) {
      const topResult = searchResults[0];
      
      logger.debug('Best knowledge match:', {
        issue: topResult.issue,
        confidence: topResult.confidence,
        source: topResult.source,
        category: topResult.category
      });
      
      bestMatch.solution = topResult;
      
      // Map categories to routes
      const categoryToRoute: Record<string, string> = {
        'booking': 'Booking & Access',
        'emergency': 'Emergency',
        'tech': 'TechSupport',
        'brand': 'BrandTone',
        'general': 'TechSupport'
      };
      
      bestMatch.route = (categoryToRoute[topResult.category] || 'TechSupport') as any;
      bestMatch.score = topResult.confidence || 0.7;
    } else {
      // Fall back to keyword matching
      for (const [route, pattern] of this.patterns) {
        let score = 0;
        const matchedKeywords: string[] = [];
        
        for (const keyword of pattern.keywords) {
          if (lowerDescription.includes(keyword)) {
            score++;
            matchedKeywords.push(keyword);
          }
        }
        
        // Normalize score based on description length
        const normalizedScore = score / Math.max(description.split(' ').length, 1);
        
        if (normalizedScore > bestMatch.score) {
          bestMatch = {
            route: route as any,
            score: normalizedScore,
            matchedKeywords,
            solution: null
          };
        }
      }
    }

    // Calculate confidence based on match score
    const confidence = Math.min(
      bestMatch.score * (this.patterns.get(bestMatch.route)?.confidence || 0.7),
      0.95 // Local provider never has >95% confidence
    );

    // Extract basic information
    const extractedInfo: Record<string, any> = {};
    
    // Add solution information if available
    if (bestMatch.solution) {
      extractedInfo.issue = bestMatch.solution.issue;
      extractedInfo.timeEstimate = bestMatch.solution.timeEstimate;
      extractedInfo.priority = bestMatch.solution.priority;
      extractedInfo.suggestedResponse = bestMatch.solution.customerScript;
      extractedInfo.escalation = bestMatch.solution.escalationPath;
      extractedInfo.solutions = bestMatch.solution.solutions;
      extractedInfo.knowledgeSource = bestMatch.solution.source;
    }
    
    // Extract time mentions
    const timeMatch = description.match(/\b(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?|\d{1,2}\s*(?:am|pm))\b/i);
    if (timeMatch) {
      extractedInfo.time = timeMatch[0];
    }
    
    // Extract date mentions
    const datePatterns = [
      /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/,
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}/i
    ];
    
    for (const pattern of datePatterns) {
      const match = description.match(pattern);
      if (match) {
        extractedInfo.date = match[0];
        break;
      }
    }
    
    // Extract bay numbers
    const bayMatch = description.match(/\bbay\s*(\d+)\b/i);
    if (bayMatch) {
      extractedInfo.bayNumber = parseInt(bayMatch[1]);
    }
    
    // Extract email addresses
    const emailMatch = description.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) {
      extractedInfo.email = emailMatch[0];
    }
    
    // Extract phone numbers
    const phoneMatch = description.match(/\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/);
    if (phoneMatch) {
      extractedInfo.phone = phoneMatch[0];
    }

    const latency = Date.now() - startTime;
    
    // Get appropriate tone from knowledge base
    let tone = 'friendly';
    if (bestMatch.route === 'emergency') {
      tone = 'urgent';
    } else if (extractedInfo.suggestedResponse && extractedInfo.suggestedResponse.includes('sorry')) {
      tone = 'apologetic';
    }

    return {
      route: bestMatch.route,
      reasoning: bestMatch.solution 
        ? `Found matching knowledge in ${bestMatch.solution.source}: ${bestMatch.solution.issue}`
        : bestMatch.matchedKeywords.length > 0
          ? `Matched keywords: ${bestMatch.matchedKeywords.join(', ')}`
          : 'No specific keywords matched, defaulting to TechSupport for general assistance',
      confidence: confidence || 0.3,
      extractedInfo,
      requestId: `local-${Date.now()}`,
      timestamp: new Date().toISOString(),
      metadata: {
        knowledgeBaseUsed: !!bestMatch.solution,
        knowledgeSource: bestMatch.solution?.source || 'keyword_matching',
        suggestedTone: tone,
        latency
      }
    };
  }

  async getUsageStats(): Promise<{
    requestsToday: number;
    tokensUsed: number;
    averageLatency: number;
    errorRate: number;
  }> {
    // Local provider doesn't track usage stats
    return {
      requestsToday: 0,
      tokensUsed: 0,
      averageLatency: 5, // Local processing is very fast
      errorRate: 0
    };
  }

  /**
   * Add custom patterns for specific use cases
   */
  addPattern(route: string, keywords: string[], confidence: number = 0.7): void {
    this.patterns.set(route, { keywords, confidence });
  }

  /**
   * Get current patterns (useful for debugging)
   */
  getPatterns(): Record<string, { keywords: string[], confidence: number }> {
    return Object.fromEntries(this.patterns);
  }
  
}