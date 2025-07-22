import OpenAI from 'openai';
import { BaseLLMProvider } from './BaseLLMProvider';
import { LLMConfig, LLMResponse } from './types';
import { logger } from '../../utils/logger';

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider extends BaseLLMProvider {
  private client: OpenAI | null = null;
  private usageStats = {
    requestsToday: 0,
    tokensUsed: 0,
    totalLatency: 0,
    errors: 0,
    lastReset: new Date().toDateString()
  };

  constructor(config: LLMConfig) {
    super(config, 'openai');
    
    if (config.apiKey) {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        organization: config.organization,
        baseURL: config.baseUrl,
        timeout: config.timeout || 30000,
        defaultHeaders: {
          ...config.customHeaders,
          ...(config.projectId ? { 'OpenAI-Project': config.projectId } : {})
        }
      });
    }
  }

  isConfigured(): boolean {
    return !!this.client && !!this.config.apiKey;
  }

  getModel(): string | null {
    return this.config.model || 'gpt-4-turbo-preview';
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      // Simple test to check if API key is valid
      const response = await this.client!.chat.completions.create({
        model: this.getModel()!,
        messages: [
          { role: 'system', content: 'Test' },
          { role: 'user', content: 'Hi' }
        ],
        max_tokens: 5
      });

      return !!response.choices[0]?.message;
    } catch (error) {
      logger.error('OpenAI connection test failed:', error);
      return false;
    }
  }

  async processRequest(
    description: string,
    userId?: string,
    context?: Record<string, any>
  ): Promise<LLMResponse> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI provider is not configured');
    }

    const startTime = Date.now();
    this.resetStatsIfNeeded();

    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: this.getSystemPrompt() }
      ];

      // Add context if provided
      if (context && Object.keys(context).length > 0) {
        messages.push({
          role: 'system',
          content: `Additional context: ${JSON.stringify(context)}`
        });
      }

      messages.push({ role: 'user', content: description });

      const response = await this.client!.chat.completions.create({
        model: this.getModel()!,
        messages,
        temperature: this.config.temperature || 0.3,
        max_tokens: this.config.maxTokens || 500,
        response_format: { type: 'json_object' },
        user: userId
      });

      const latency = Date.now() - startTime;
      const usage = response.usage;

      // Update stats
      this.usageStats.requestsToday++;
      if (usage) {
        this.usageStats.tokensUsed += usage.total_tokens || 0;
      }
      this.usageStats.totalLatency += latency;

      await this.logUsage(usage?.total_tokens || 0, latency, true);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      const parsedResponse = JSON.parse(content);
      return this.validateResponse(parsedResponse);

    } catch (error: any) {
      this.usageStats.errors++;
      const latency = Date.now() - startTime;
      
      await this.logUsage(0, latency, false);
      
      logger.error('OpenAI processing error:', error);
      
      if (error.code === 'insufficient_quota') {
        throw new Error('OpenAI API quota exceeded');
      } else if (error.code === 'invalid_api_key') {
        throw new Error('Invalid OpenAI API key');
      } else {
        throw new Error(`OpenAI processing failed: ${error.message}`);
      }
    }
  }

  async getUsageStats(): Promise<{
    requestsToday: number;
    tokensUsed: number;
    averageLatency: number;
    errorRate: number;
  }> {
    this.resetStatsIfNeeded();

    const totalRequests = this.usageStats.requestsToday + this.usageStats.errors;
    const averageLatency = totalRequests > 0
      ? this.usageStats.totalLatency / totalRequests
      : 0;
    const errorRate = totalRequests > 0
      ? this.usageStats.errors / totalRequests
      : 0;

    return {
      requestsToday: this.usageStats.requestsToday,
      tokensUsed: this.usageStats.tokensUsed,
      averageLatency: Math.round(averageLatency),
      errorRate: Math.round(errorRate * 100) / 100
    };
  }

  private resetStatsIfNeeded(): void {
    const today = new Date().toDateString();
    if (this.usageStats.lastReset !== today) {
      this.usageStats = {
        requestsToday: 0,
        tokensUsed: 0,
        totalLatency: 0,
        errors: 0,
        lastReset: today
      };
    }
  }
}
