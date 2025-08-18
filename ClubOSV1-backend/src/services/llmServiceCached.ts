import { config } from '../utils/envValidator';
import { logger } from '../utils/logger';
import { cacheService } from './cacheService';
import { usageTrackingService } from './usageTrackingService';
import { LLMService } from './llmService';

/**
 * Cached wrapper for existing LLM Service
 * Maintains GPT-4 while adding caching and usage tracking
 */
export class CachedLLMService {
  private llmService: LLMService;
  private static instance: CachedLLMService;

  constructor() {
    this.llmService = LLMService.getInstance();
  }

  static getInstance(): CachedLLMService {
    if (!CachedLLMService.instance) {
      CachedLLMService.instance = new CachedLLMService();
    }
    return CachedLLMService.instance;
  }

  /**
   * Process request with caching layer
   */
  async processRequest(
    description: string,
    userId?: string,
    context?: Record<string, any>
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Generate cache key based on request
      const cacheKey = cacheService.generateKey('llm:response', {
        description: description.substring(0, 200), // First 200 chars for uniqueness
        route: context?.route,
        type: context?.type
      });

      // Check cache first (unless explicitly disabled)
      if (!context?.noCache) {
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          logger.info('LLM response cache hit', { 
            responseTime: Date.now() - startTime 
          });
          
          // Track cache hit
          if (userId) {
            await usageTrackingService.trackUsage({
              user_id: parseInt(userId),
              endpoint: '/llm/process',
              model: 'cache',
              response_time_ms: Date.now() - startTime,
              cache_hit: true,
              metadata: { route: context?.route }
            });
          }
          
          return {
            ...cached as any,
            cached: true,
            responseTime: Date.now() - startTime
          };
        }
      }

      // Call original LLM service
      const response = await this.llmService.processRequest(
        description,
        userId,
        context
      );

      // Cache successful responses with high confidence
      if (response.confidence > 0.6) {
        await cacheService.set(cacheKey, response, {
          ttl: 3600, // 1 hour cache
          prefix: 'llm'
        });
      }

      // Track usage
      if (userId) {
        const responseData = response as any;
        await usageTrackingService.trackUsage({
          user_id: parseInt(userId),
          endpoint: '/llm/process',
          model: responseData.model || 'gpt-4',
          tokens_used: responseData.usage?.total_tokens,
          response_time_ms: Date.now() - startTime,
          cache_hit: false,
          metadata: {
            route: response.route,
            confidence: response.confidence,
            provider: responseData.provider
          }
        });
      }

      return {
        ...response,
        cached: false,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Failed to process cached LLM request:', error);
      
      // Track error
      if (userId) {
        await usageTrackingService.trackUsage({
          user_id: parseInt(userId),
          endpoint: '/llm/process',
          response_time_ms: Date.now() - startTime,
          error: String(error)
        });
      }
      
      throw error;
    }
  }

  /**
   * Route request with caching (using existing routeWithoutLLM for simplicity)
   */
  async routeRequest(
    description: string,
    userId?: string,
    context?: Record<string, any>
  ): Promise<any> {
    const startTime = Date.now();
    
    // Generate cache key for routing
    const cacheKey = cacheService.generateKey('llm:route', {
      description: description.substring(0, 100)
    });

    // Check cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Route cache hit');
      return cached;
    }

    // Use existing routing method
    const response = this.llmService.routeWithoutLLM(description);

    // Cache the routing result
    await cacheService.set(cacheKey, response, {
      ttl: 7200, // 2 hour cache for routes
      prefix: 'route'
    });

    // Track usage
    if (userId) {
      await usageTrackingService.trackUsage({
        user_id: parseInt(userId),
        endpoint: '/llm/route',
        model: 'local',
        response_time_ms: Date.now() - startTime,
        cache_hit: false
      });
    }

    return response;
  }

  /**
   * Clear cache for specific patterns
   */
  async clearCache(pattern?: string): Promise<number> {
    if (pattern) {
      return await cacheService.clearPrefix(`llm:${pattern}`);
    }
    return await cacheService.clearPrefix('llm');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return cacheService.getStats();
  }

  /**
   * Forward other methods to original service
   */
  getAvailableRoutes() {
    // Return standard routes
    return ['Emergency', 'Booking & Access', 'Tech Support', 'Brand Tone'];
  }

  isConfigured() {
    return this.llmService.isConfigured();
  }

  // Forward analyze for automation
  analyzeForAutomation(message: string) {
    return this.llmService.analyzeForAutomation(message);
  }

  // Forward route without LLM
  routeWithoutLLM(description: string) {
    return this.llmService.routeWithoutLLM(description);
  }
}

// Export cached version
export const cachedLLMService = CachedLLMService.getInstance();