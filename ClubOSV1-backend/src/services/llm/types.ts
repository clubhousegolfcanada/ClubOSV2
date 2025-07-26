/**
 * Types for LLM abstraction layer
 */

export interface LLMConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  baseUrl?: string;
  organization?: string;
  projectId?: string;
  customHeaders?: Record<string, string>;
}

export interface LLMResponse {
  route: 'booking' | 'access' | 'emergency' | 'tech' | 'brand' | 'general' | 'Booking & Access' | 'Emergency' | 'TechSupport' | 'BrandTone' | string;
  reasoning: string;
  confidence: number;
  response?: string | null;
  extractedInfo?: Record<string, any>;
  requestId: string;
  timestamp: string;
  provider?: string;
  suggestedActions?: string[];
  structuredResponse?: any;
  category?: string;
  priority?: string;
  actions?: Array<{
    type: string;
    description: string;
    details?: any;
  }>;
  metadata?: any;
  escalation?: any;
}

export interface LLMProvider {
  getName(): string;
  isConfigured(): boolean;
  processRequest(
    description: string,
    userId?: string,
    context?: Record<string, any>
  ): Promise<LLMResponse>;
  getModel(): string | null;
  testConnection(): Promise<boolean>;
  getUsageStats(): Promise<{
    requestsToday: number;
    tokensUsed: number;
    averageLatency: number;
    errorRate: number;
  }>;
}

export interface LLMRouterConfig {
  providers: {
    name: string;
    provider: LLMProvider;
    priority: number;
    enabled: boolean;
  }[];
  fallbackToLocal: boolean;
  retryAttempts: number;
  retryDelay: number;
}

export interface ProviderMetrics {
  provider: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  lastError?: string;
  lastErrorTime?: Date;
}
