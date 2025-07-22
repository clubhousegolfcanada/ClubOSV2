import { LLMResponse, LLMProvider, LLMConfig } from './types';

/**
 * Abstract base class for LLM providers
 * All LLM implementations must extend this class
 */
export abstract class BaseLLMProvider implements LLMProvider {
  protected config: LLMConfig;
  protected name: string;

  constructor(config: LLMConfig, name: string) {
    this.config = config;
    this.name = name;
  }

  /**
   * Get the provider name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Check if the provider is properly configured
   */
  abstract isConfigured(): boolean;

  /**
   * Process a request through the LLM
   */
  abstract processRequest(
    description: string,
    userId?: string,
    context?: Record<string, any>
  ): Promise<LLMResponse>;

  /**
   * Get the current model being used
   */
  abstract getModel(): string | null;

  /**
   * Test the connection to the LLM service
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Get usage statistics for the provider
   */
  abstract getUsageStats(): Promise<{
    requestsToday: number;
    tokensUsed: number;
    averageLatency: number;
    errorRate: number;
  }>;

  /**
   * Common method to format the system prompt
   */
  protected getSystemPrompt(): string {
    return `You are ClubOSV1, an intelligent routing system for a golf simulator facility.
Your task is to analyze user requests and route them to the appropriate bot/service.

Available routes:
- Booking & Access: For reservations, cancellations, booking changes, returns/refunds of bookings, availability checks, door access, key cards, entry permissions
- Emergency: For urgent issues, safety concerns, accidents, injuries, fire, medical emergencies, power outages
- TechSupport: For technical issues with equipment (TrackMan, screens, computers), software problems, equipment malfunctions
- BrandTone: For marketing, promotions, membership information, pricing, general facility information, gift cards

IMPORTANT: 
- "return" in the context of bookings means refunding or canceling a reservation, which should go to "Booking & Access"
- Power outages should be routed to "Emergency" as they affect safety and operations

You must respond in JSON format with:
{
  "route": "selected_route",
  "reasoning": "explanation of why this route was chosen",
  "confidence": 0.0-1.0,
  "extractedInfo": {
    // Any relevant information extracted from the request
  }
}`;
  }

  /**
   * Common method to validate and parse LLM response
   */
  protected validateResponse(response: any): LLMResponse {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response format from LLM');
    }

    if (!response.route || typeof response.route !== 'string') {
      throw new Error('Response missing required "route" field');
    }

    const validRoutes = ['Booking & Access', 'Emergency', 'TechSupport', 'BrandTone', 'Auto'];
    if (!validRoutes.includes(response.route)) {
      // Try to map old routes to new ones for backward compatibility
      const routeMap: Record<string, string> = {
        'booking': 'Booking & Access',
        'access': 'Booking & Access',
        'emergency': 'Emergency',
        'tech': 'TechSupport',
        'brand': 'BrandTone',
        'general': 'BrandTone'
      };
      
      if (routeMap[response.route]) {
        response.route = routeMap[response.route];
      } else {
        throw new Error(`Invalid route: ${response.route}`);
      }
    }

    return {
      route: response.route,
      reasoning: response.reasoning || 'No reasoning provided',
      confidence: typeof response.confidence === 'number' ? response.confidence : 0.5,
      response: response.response || null, // Include the response text
      extractedInfo: response.extractedInfo || {},
      requestId: `${this.name}-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log usage metrics (to be implemented by providers)
   */
  protected async logUsage(
    tokens: number,
    latency: number,
    success: boolean
  ): Promise<void> {
    // Default implementation - can be overridden
    // This would typically log to a metrics service
  }
}
