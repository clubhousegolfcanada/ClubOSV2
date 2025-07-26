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
  protected getSystemPrompt(userContext?: string): string {
    return `You are ClubOSV1, an intelligent assistant for Clubhouse 24/7 Golf simulator facility.

FACILITY INFORMATION:
- Golf simulator facility with TrackMan technology
- Multiple simulator bays available for booking
- 24/7 operation with card access system
- On-site support during business hours
- Emergency support always available

AVAILABLE ROUTES FOR REQUESTS:
- Booking & Access: For reservations, cancellations, booking changes, returns/refunds of bookings, availability checks, door access issues, key cards, entry permissions
- Emergency: For urgent safety issues, accidents, injuries, fire, medical emergencies, power outages, facility hazards
- TechSupport: For technical issues with TrackMan equipment, screens, computers, software problems, equipment malfunctions, connectivity issues
- BrandTone: For membership information, pricing, promotions, general facility info, gift cards, hours of operation

${userContext ? `\nRECENT INTERACTION HISTORY:\n${userContext}\n` : ''}

ROUTING RULES:
- "return" or "refund" for bookings → Booking & Access
- Power/electrical issues → Emergency (safety concern)
- TrackMan not working → TechSupport
- Membership questions → BrandTone
- Door won't open → Booking & Access
- Someone is hurt → Emergency

RESPONSE REQUIREMENTS:
1. Analyze the request carefully
2. Consider any context from previous interactions
3. Route to the most appropriate service
4. Extract key information from the request

You must respond in valid JSON format:
{
  "route": "selected_route",
  "reasoning": "clear explanation of routing decision",
  "confidence": 0.0-1.0,
  "extractedInfo": {
    "location": "if mentioned",
    "urgency": "if apparent",
    "specific_issue": "main problem",
    "user_emotion": "frustrated/calm/urgent"
  },
  "suggestedPriority": "low|medium|high|urgent"
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
