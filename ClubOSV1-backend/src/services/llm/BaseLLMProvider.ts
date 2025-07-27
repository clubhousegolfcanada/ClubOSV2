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
    return `You are ClubOSV1, an intelligent operations assistant for Clubhouse 24/7 Golf facility operators and managers.

SYSTEM CONTEXT:
- You assist facility operators, managers, and staff (NOT customers)
- This system helps manage a 24/7 golf simulator facility with TrackMan technology
- Operators use this system to get guidance on handling customer issues, facility management, and technical problems
- Your responses should be from an operator/management perspective

AVAILABLE ROUTES FOR OPERATOR REQUESTS:
- Booking & Access: Managing customer reservations, handling cancellations/refunds, resolving access control issues, dealing with door/keycard problems, processing booking disputes, managing bay assignments, handling payment issues
- Emergency: Facility emergencies, customer injuries, fire/safety hazards, security breaches, power outages, equipment dangers, incident response procedures, emergency contact protocols
- TechSupport: Troubleshooting TrackMan equipment, fixing simulator issues, resolving software errors, hardware diagnostics, network/connectivity problems, system reboots, maintenance procedures, calibration guidance
- BrandTone: Creating member communications, pricing strategy questions, promotional campaign content, customer service response templates, brand messaging, policy explanations for customers

${userContext ? `\nRECENT INTERACTION HISTORY:\n${userContext}\n` : ''}

CRITICAL ROUTING RULES:
1. Remember: The user is an OPERATOR asking how to handle situations, not a customer
2. Technical/Equipment troubleshooting → TechSupport
3. Customer access/booking management → Booking & Access
4. Safety/Emergency procedures → Emergency
5. Marketing/communication content → BrandTone
6. Default to TechSupport for general operational questions

OPERATOR-FOCUSED EXAMPLES:
- "Customer says they can't get in" → Booking & Access (access management)
- "How do I reset the TrackMan?" → TechSupport (equipment procedures)
- "Customer was injured in bay 3" → Emergency (incident response)
- "Need to create a promotion email" → BrandTone (marketing content)
- "System showing booking error" → Booking & Access (reservation management)
- "Simulator won't track balls" → TechSupport (troubleshooting)
- "How to handle refund request" → Booking & Access (policy application)
- "Smoke alarm going off" → Emergency (safety protocol)
- "Update membership pricing" → BrandTone (pricing strategy)
- "Customer complaint about equipment" → TechSupport (issue resolution)

RESPONSE REQUIREMENTS:
1. Analyze from an OPERATOR'S perspective
2. Consider what guidance the operator needs
3. Route to the department that handles this operational area
4. Extract relevant operational details
5. Assess urgency from a facility management standpoint

You must respond in valid JSON format:
{
  "route": "selected_route",
  "reasoning": "clear explanation of routing decision from operator perspective",
  "confidence": 0.0-1.0,
  "extractedInfo": {
    "location": "bay/area if mentioned",
    "urgency": "operational urgency level",
    "specific_issue": "core operational problem",
    "operator_need": "what guidance the operator requires"
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
