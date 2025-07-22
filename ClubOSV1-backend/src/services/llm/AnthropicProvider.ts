import { BaseLLMProvider } from './BaseLLMProvider';
import { LLMConfig, LLMResponse } from './types';
import { logger } from '../../utils/logger';
import axios, { AxiosInstance } from 'axios';

/**
 * Anthropic Claude provider implementation
 */
export class AnthropicProvider extends BaseLLMProvider {
  private client: AxiosInstance | null = null;
  private usageStats = {
    requestsToday: 0,
    tokensUsed: 0,
    totalLatency: 0,
    errors: 0,
    lastReset: new Date().toDateString()
  };

  constructor(config: LLMConfig) {
    super(config, 'anthropic');
    
    if (config.apiKey) {
      this.client = axios.create({
        baseURL: config.baseUrl || 'https://api.anthropic.com',
        timeout: config.timeout || 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
          'anthropic-version': '2023-06-01',
          ...config.customHeaders
        }
      });
    }
  }

  isConfigured(): boolean {
    return !!this.client && !!this.config.apiKey;
  }

  getModel(): string | null {
    return this.config.model || 'claude-3-opus-20240229';
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await this.client!.post('/v1/messages', {
        model: this.getModel(),
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5
      });

      return response.status === 200;
    } catch (error) {
      logger.error('Anthropic connection test failed:', error);
      return false;
    }
  }

  async processRequest(
    description: string,
    userId?: string,
    context?: Record<string, any>
  ): Promise<LLMResponse> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic provider is not configured');
    }

    const startTime = Date.now();
    this.resetStatsIfNeeded();

    try {
      let systemPrompt = this.getSystemPrompt();
      
      // Add context to system prompt if provided
      if (context && Object.keys(context).length > 0) {
        systemPrompt += `\n\nAdditional context: ${JSON.stringify(context)}`;
      }

      const response = await this.client!.post('/v1/messages', {
        model: this.getModel(),
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: description
          }
        ],
        max_tokens: this.config.maxTokens || 500,
        temperature: this.config.temperature || 0.3,
        metadata: {
          user_id: userId
        }
      });

      const latency = Date.now() - startTime;
      const usage = response.data.usage;

      // Update stats
      this.usageStats.requestsToday++;
      if (usage) {
        this.usageStats.tokensUsed += usage.output_tokens + usage.input_tokens;
      }
      this.usageStats.totalLatency += latency;

      await this.logUsage(
        usage ? usage.output_tokens + usage.input_tokens : 0,
        latency,
        true
      );

      const content = response.data.content[0]?.text;
      if (!content) {
        throw new Error('No content in Anthropic response');
      }

      // Extract JSON from the response (Claude might include explanation text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Anthropic response');
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);
      return this.validateResponse(parsedResponse);

    } catch (error: any) {
      this.usageStats.errors++;
      const latency = Date.now() - startTime;
      
      await this.logUsage(0, latency, false);
      
      logger.error('Anthropic processing error:', error);
      
      if (error.response?.status === 429) {
        throw new Error('Anthropic API rate limit exceeded');
      } else if (error.response?.status === 401) {
        throw new Error('Invalid Anthropic API key');
      } else {
        throw new Error(`Anthropic processing failed: ${error.message}`);
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
