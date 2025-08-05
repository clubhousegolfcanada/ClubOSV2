import { AssistantService } from './assistantService';
import { logger } from '../utils/logger';

/**
 * Lazy-loaded assistant service to handle Railway environment variable timing issues
 * This ensures the service is only created when first used, after env vars are loaded
 */
class LazyAssistantService {
  private _instance: AssistantService | null = null;
  private initAttempted = false;
  
  private getInstance(): AssistantService | null {
    if (!this.initAttempted) {
      this.initAttempted = true;
      try {
        // Log current environment state
        logger.info('LazyAssistantService: Initializing with environment', {
          hasApiKey: !!process.env.OPENAI_API_KEY,
          apiKeyPrefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'NOT SET',
          hasBookingAssistant: !!process.env.BOOKING_ACCESS_GPT_ID,
          hasEmergencyAssistant: !!process.env.EMERGENCY_GPT_ID,
          hasTechAssistant: !!process.env.TECH_SUPPORT_GPT_ID,
          hasBrandAssistant: !!process.env.BRAND_MARKETING_GPT_ID
        });
        
        this._instance = new AssistantService();
      } catch (error) {
        logger.error('Failed to initialize AssistantService:', error);
        this._instance = null;
      }
    }
    return this._instance;
  }
  
  async getAssistantResponse(...args: Parameters<AssistantService['getAssistantResponse']>) {
    const instance = this.getInstance();
    if (!instance) {
      logger.error('AssistantService not available - returning fallback');
      return {
        response: 'I apologize, but I am temporarily unable to process your request. Please try again later or contact support.',
        assistantId: 'unavailable',
        threadId: 'unavailable',
        confidence: 0
      };
    }
    return instance.getAssistantResponse(...args);
  }
  
  async updateAssistantKnowledge(...args: Parameters<AssistantService['updateAssistantKnowledge']>) {
    const instance = this.getInstance();
    if (!instance) {
      return {
        success: false,
        message: 'Assistant service not available'
      };
    }
    return instance.updateAssistantKnowledge(...args);
  }
}

// Export a lazy-loaded singleton
export const assistantService = new LazyAssistantService();