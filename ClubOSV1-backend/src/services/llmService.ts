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
   * Analyze a message to determine if it should trigger an automated response
   */
  async analyzeForAutomation(message: string): Promise<{
    shouldRespond: boolean;
    detectedIntent?: string;
    confidence: number;
    reason?: string;
    response?: string;
  }> {
    try {
      const systemPrompt = `You are analyzing customer messages to determine if they should receive an automated response.
      
Analyze the message and determine:
1. If it's a simple inquiry that can be answered automatically
2. What the customer's intent is
3. If we have knowledge to respond

Common automated responses include:
- Gift card inquiries (how to purchase, availability)
- Hours of operation
- Location/directions
- Membership information
- Basic pricing questions

DO NOT automate:
- Complex technical issues
- Complaints or concerns
- Requests that need human judgment
- Emergencies

Respond with JSON: {
  "shouldRespond": true/false,
  "detectedIntent": "gift_card|hours|location|membership|pricing|other",
  "confidence": 0.0-1.0,
  "reason": "why or why not to respond",
  "suggestedTopic": "what to search for in knowledge base"
}`;

      // Create a simplified request for automation analysis
      const analysisPrompt = `${systemPrompt}\n\nMessage to analyze: "${message}"`;
      
      // Import OpenAI client directly
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });
      
      try {
        const analysis = JSON.parse(completion.choices[0].message.content || '{}');
        logger.info('Automation analysis result', {
          message: message.substring(0, 50),
          ...analysis
        });
        return analysis;
      } catch (parseError) {
        logger.error('Failed to parse automation analysis:', parseError);
        return {
          shouldRespond: false,
          confidence: 0,
          reason: 'Failed to analyze message'
        };
      }
    } catch (error) {
      logger.error('Failed to analyze message for automation:', error);
      return {
        shouldRespond: false,
        confidence: 0,
        reason: 'Analysis error'
      };
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
      let route: any = 'TechSupport'; // Default to TechSupport instead of BrandTone
      
      // Emergency - highest priority
      if (lowerDescription.includes('emergency') || lowerDescription.includes('fire') || 
          lowerDescription.includes('injury') || lowerDescription.includes('hurt') || 
          lowerDescription.includes('accident') || lowerDescription.includes('smoke') ||
          lowerDescription.includes('security') || lowerDescription.includes('threat')) {
        route = 'Emergency';
      } 
      // Booking & Access
      else if (lowerDescription.includes('unlock') || lowerDescription.includes('door') || 
               lowerDescription.includes('access') || lowerDescription.includes('locked') || 
               lowerDescription.includes('key') || lowerDescription.includes('book') || 
               lowerDescription.includes('reservation') || lowerDescription.includes('cancel') || 
               lowerDescription.includes('reschedule') || lowerDescription.includes('return') || 
               lowerDescription.includes('refund') || lowerDescription.includes('card won') ||
               lowerDescription.includes('can\'t get in') || lowerDescription.includes('payment')) {
        route = 'Booking & Access';
      } 
      // TechSupport - expanded keywords
      else if (lowerDescription.includes('trackman') || lowerDescription.includes('frozen') || 
               lowerDescription.includes('technical') || lowerDescription.includes('screen') || 
               lowerDescription.includes('equipment') || lowerDescription.includes('tech') || 
               lowerDescription.includes('support') || lowerDescription.includes('issue') || 
               lowerDescription.includes('problem') || lowerDescription.includes('fix') || 
               lowerDescription.includes('broken') || lowerDescription.includes('restart') || 
               lowerDescription.includes('reboot') || lowerDescription.includes('simulator') ||
               lowerDescription.includes('how do i use') || lowerDescription.includes('not working') ||
               lowerDescription.includes('ball') || lowerDescription.includes('tracking') ||
               lowerDescription.includes('sensor') || lowerDescription.includes('calibrat')) {
        route = 'TechSupport';
      } 
      // BrandTone - ONLY for specific membership/pricing/promotion queries
      else if ((lowerDescription.includes('member') && (lowerDescription.includes('ship') || lowerDescription.includes('become'))) || 
               (lowerDescription.includes('price') || lowerDescription.includes('cost') || lowerDescription.includes('how much')) || 
               lowerDescription.includes('gift card') || lowerDescription.includes('promotion') ||
               lowerDescription.includes('hours') || lowerDescription.includes('loyalty')) {
        route = 'BrandTone';
      }
      // Default to TechSupport for general queries (not BrandTone)
      
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
        route: 'TechSupport', // Default to TechSupport on error
        reasoning: 'Error in routing - defaulting to TechSupport',
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
