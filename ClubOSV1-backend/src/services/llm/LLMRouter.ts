import { LLMProvider, LLMResponse, LLMRouterConfig, ProviderMetrics } from './types';
import { logger } from '../../utils/logger';
import { LocalProvider } from './LocalProvider';

/**
 * LLM Router that manages multiple LLM providers
 * Handles failover, load balancing, and provider selection
 */
export class LLMRouter {
  private providers: Map<string, {
    provider: LLMProvider;
    priority: number;
    enabled: boolean;
    metrics: ProviderMetrics;
  }> = new Map();
  
  private config: LLMRouterConfig;
  private localProvider: LocalProvider;

  constructor(config?: Partial<LLMRouterConfig>) {
    this.config = {
      providers: [],
      fallbackToLocal: true,
      retryAttempts: 2,
      retryDelay: 1000,
      ...config
    };

    // Always have a local provider as ultimate fallback
    this.localProvider = new LocalProvider();
    
    // Initialize providers from config
    this.config.providers.forEach(providerConfig => {
      this.addProvider(
        providerConfig.name,
        providerConfig.provider,
        providerConfig.priority,
        providerConfig.enabled
      );
    });
  }

  /**
   * Add a provider to the router
   */
  addProvider(
    name: string,
    provider: LLMProvider,
    priority: number = 0,
    enabled: boolean = true
  ): void {
    this.providers.set(name, {
      provider,
      priority,
      enabled,
      metrics: {
        provider: name,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: 0
      }
    });

    logger.info(`Added LLM provider: ${name} (priority: ${priority}, enabled: ${enabled})`);
  }

  /**
   * Remove a provider from the router
   */
  removeProvider(name: string): boolean {
    const removed = this.providers.delete(name);
    if (removed) {
      logger.info(`Removed LLM provider: ${name}`);
    }
    return removed;
  }

  /**
   * Enable or disable a provider
   */
  setProviderEnabled(name: string, enabled: boolean): void {
    const provider = this.providers.get(name);
    if (provider) {
      provider.enabled = enabled;
      logger.info(`Provider ${name} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get list of available providers sorted by priority
   */
  private getAvailableProviders(): Array<{
    name: string;
    provider: LLMProvider;
    priority: number;
  }> {
    return Array.from(this.providers.entries())
      .filter(([_, config]) => config.enabled && config.provider.isConfigured())
      .map(([name, config]) => ({
        name,
        provider: config.provider,
        priority: config.priority
      }))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Process request through available providers
   */
  async processRequest(
    description: string,
    userId?: string,
    context?: Record<string, any>,
    preferredProvider?: string
  ): Promise<LLMResponse & { provider: string }> {
    const startTime = Date.now();
    const availableProviders = this.getAvailableProviders();

    // Try preferred provider first if specified
    if (preferredProvider) {
      const preferred = this.providers.get(preferredProvider);
      if (preferred?.enabled && preferred.provider.isConfigured()) {
        try {
          const response = await this.tryProvider(
            preferredProvider,
            preferred.provider,
            description,
            userId,
            context
          );
          return { ...response, provider: preferredProvider };
        } catch (error) {
          logger.warn(`Preferred provider ${preferredProvider} failed, trying others`);
        }
      }
    }

    // Try providers in priority order
    let lastError: Error | null = null;
    
    for (const { name, provider } of availableProviders) {
      if (name === preferredProvider) continue; // Already tried
      
      try {
        const response = await this.tryProvider(
          name,
          provider,
          description,
          userId,
          context
        );
        return { ...response, provider: name };
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Provider ${name} failed: ${error}`);
        continue;
      }
    }

    // Fallback to local provider if enabled
    if (this.config.fallbackToLocal) {
      logger.info('All providers failed, falling back to local provider');
      const response = await this.localProvider.processRequest(
        description,
        userId,
        context
      );
      return { ...response, provider: 'local' };
    }

    // All providers failed
    throw new Error(
      `All LLM providers failed. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Try a specific provider with retry logic
   */
  private async tryProvider(
    name: string,
    provider: LLMProvider,
    description: string,
    userId?: string,
    context?: Record<string, any>
  ): Promise<LLMResponse> {
    const providerConfig = this.providers.get(name)!;
    const startTime = Date.now();
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        if (attempt > 0) {
          await this.delay(this.config.retryDelay * attempt);
          logger.info(`Retry attempt ${attempt} for provider ${name}`);
        }

        const response = await provider.processRequest(description, userId, context);
        
        // Update metrics on success
        const latency = Date.now() - startTime;
        this.updateMetrics(name, true, latency);
        
        return response;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          break;
        }
      }
    }

    // Update metrics on failure
    const latency = Date.now() - startTime;
    this.updateMetrics(name, false, latency, lastError);
    
    throw lastError || new Error(`Provider ${name} failed`);
  }

  /**
   * Check if an error should not be retried
   */
  private isNonRetryableError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    return (
      message.includes('api key') ||
      message.includes('quota exceeded') ||
      message.includes('not configured')
    );
  }

  /**
   * Update provider metrics
   */
  private updateMetrics(
    name: string,
    success: boolean,
    latency: number,
    error?: Error | null
  ): void {
    const provider = this.providers.get(name);
    if (!provider) return;

    const metrics = provider.metrics;
    metrics.totalRequests++;
    
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
      if (error) {
        metrics.lastError = error.message;
        metrics.lastErrorTime = new Date();
      }
    }

    // Update average latency
    metrics.averageLatency = 
      (metrics.averageLatency * (metrics.totalRequests - 1) + latency) / 
      metrics.totalRequests;
  }

  /**
   * Get metrics for all providers
   */
  getMetrics(): ProviderMetrics[] {
    return Array.from(this.providers.values()).map(p => p.metrics);
  }

  /**
   * Get status of all providers
   */
  async getStatus(): Promise<Array<{
    name: string;
    enabled: boolean;
    configured: boolean;
    priority: number;
    model: string | null;
    connected: boolean;
    metrics: ProviderMetrics;
  }>> {
    const statuses = [];

    for (const [name, config] of this.providers) {
      const connected = await config.provider.testConnection().catch(() => false);
      
      statuses.push({
        name,
        enabled: config.enabled,
        configured: config.provider.isConfigured(),
        priority: config.priority,
        model: config.provider.getModel(),
        connected,
        metrics: config.metrics
      });
    }

    return statuses;
  }

  /**
   * Test all providers
   */
  async testAllProviders(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, config] of this.providers) {
      if (config.enabled) {
        results[name] = await config.provider.testConnection().catch(() => false);
      }
    }

    return results;
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
