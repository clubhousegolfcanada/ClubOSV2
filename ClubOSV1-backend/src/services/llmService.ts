import { config } from '../utils/envValidator';
import { logger } from '../utils/logger';
import { 
  LLMRouter, 
  OpenAIProvider, 
  AnthropicProvider,
  LocalProvider,
  LLMResponse 
} from './llm';

/**
 * LLM Service - Updated to use the new router abstraction
 */
export class LLMService {
  private router: LLMRouter;
  private static instance: LLMService;

  constructor() {
    // Initialize router
    this.router = new LLMRouter({
      fallbackToLocal: true,
      retryAttempts: 2,
      retryDelay: 1000
    });

    // Add OpenAI provider if configured
    if (config.OPENAI_API_KEY) {
      // Check if we're in demo mode
      const isDemoMode = process.env.ENABLE_DEMO_MODE === 'true' && 
                        config.OPENAI_API_KEY === 'sk-demo-key-for-testing-only';
      
      if (isDemoMode) {
        logger.info('🎮 Running in DEMO MODE - Using local provider instead of OpenAI');
        // Use local provider as "OpenAI" in demo mode
        const localProvider = new LocalProvider();
        this.router.addProvider('openai', localProvider, 100, true);
      } else {
        const openAIProvider = new OpenAIProvider({
          apiKey: config.OPENAI_API_KEY,
          model: config.OPENAI_MODEL,
          maxTokens: parseInt(config.OPENAI_MAX_TOKENS || '500'),
          temperature: parseFloat(config.OPENAI_TEMPERATURE || '0.3'),
          organization: process.env.OPENAI_ORGANIZATION,
          projectId: process.env.OPENAI_PROJECT_ID
        });
        
        this.router.addProvider('openai', openAIProvider, 100, true);
      }
    }

    // Add Anthropic provider if configured
    if (process.env.ANTHROPIC_API_KEY) {
      const anthropicProvider = new AnthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229'
      });
      
      this.router.addProvider('anthropic', anthropicProvider, 90, true);
    }

    // Local provider is always available as fallback
    logger.info('LLM Service initialized with router');
  }

  static getInstance(): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService();
    }
    return LLMService.instance;
  }

  /**
   * Process request through LLM router
   */
  async processRequest(
    description: string,
    userId?: string,
    context?: Record<string, any>
  ): Promise<LLMResponse> {
    try {
      const response = await this.router.processRequest(
        description,
        userId,
        context
      );

      logger.info(`Request processed by ${response.provider} provider`, {
        route: response.route,
        confidence: response.confidence,
        provider: response.provider
      });

      return response;
    } catch (error) {
      logger.error('Failed to process request with LLM:', error);
      throw new Error('Failed to process request with LLM');
    }
  }

  /**
   * Route without LLM (backward compatibility)
   */
  routeWithoutLLM(description: string): LLMResponse {
    const localProvider = new LocalProvider();
    // Create a synchronous response for backward compatibility
    try {
      // LocalProvider's processRequest is actually async, so we need to handle it properly
      // For now, create a simple response directly
      const lowerDescription = description.toLowerCase();
      let route: any = 'BrandTone';
      
      if (lowerDescription.includes('emergency') || lowerDescription.includes('fire') || lowerDescription.includes('injury') || lowerDescription.includes('hurt') || lowerDescription.includes('accident')) {
        route = 'Emergency';
      } else if (lowerDescription.includes('unlock') || lowerDescription.includes('door') || lowerDescription.includes('access') || lowerDescription.includes('locked') || lowerDescription.includes('key') || lowerDescription.includes('book') || lowerDescription.includes('reservation') || lowerDescription.includes('cancel') || lowerDescription.includes('reschedule') || lowerDescription.includes('return') || lowerDescription.includes('refund')) {
        route = 'Booking & Access';
      } else if (lowerDescription.includes('trackman') || lowerDescription.includes('frozen') || lowerDescription.includes('technical') || lowerDescription.includes('screen') || lowerDescription.includes('equipment') || lowerDescription.includes('tech') || lowerDescription.includes('support') || lowerDescription.includes('issue') || lowerDescription.includes('problem') || lowerDescription.includes('fix') || lowerDescription.includes('broken') || lowerDescription.includes('restart') || lowerDescription.includes('reboot')) {
        route = 'TechSupport';
      } else if (lowerDescription.includes('member') || lowerDescription.includes('price') || lowerDescription.includes('gift') || lowerDescription.includes('promotion')) {
        route = 'BrandTone';
      }
      
      return {
        route,
        reasoning: 'Fallback routing based on keywords',
        confidence: 0.5,
        extractedInfo: {},
        requestId: `local-${Date.now()}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error in routeWithoutLLM:', error);
      return {
        route: 'general',
        reasoning: 'Error in routing',
        confidence: 0.1,
        extractedInfo: {},
        requestId: `error-${Date.now()}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check if any LLM provider is configured
   */
  isConfigured(): boolean {
    const status = this.router.getStatus();
    return status.then(providers => 
      providers.some(p => p.configured && p.enabled)
    ).catch(() => false) as any;
  }

  /**
   * Check if LLM service is enabled
   */
  isEnabled(): boolean {
    // For now, return true if configured
    // In demo mode, this will be true since we use LocalProvider
    return true;
  }

  /**
   * Get router status
   */
  async getRouterStatus() {
    return await this.router.getStatus();
  }

  /**
   * Get provider metrics
   */
  getMetrics() {
    return this.router.getMetrics();
  }

  /**
   * Test all providers
   */
  async testProviders() {
    return await this.router.testAllProviders();
  }

  /**
   * Switch provider priority
   */
  setProviderPriority(provider: string, priority: number) {
    // Remove and re-add with new priority
    const providers = this.router.getStatus();
    providers.then(list => {
      const found = list.find(p => p.name === provider);
      if (found) {
        this.router.removeProvider(provider);
        this.router.addProvider(provider, found as any, priority, found.enabled);
      }
    });
  }

  /**
   * Enable/disable a provider
   */
  setProviderEnabled(provider: string, enabled: boolean) {
    this.router.setProviderEnabled(provider, enabled);
  }
}

// Export singleton instance
export const llmService = LLMService.getInstance();
