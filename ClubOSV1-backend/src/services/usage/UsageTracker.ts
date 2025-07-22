import { UsageRecord, UsageStats, UserUsage, ApiKeyUsage, UsageConfig } from './types';
import { readJsonFile, writeJsonFile, ensureFileExists } from '../../utils/fileUtils';
import { logger } from '../../utils/logger';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for tracking and managing API usage
 */
export class UsageTracker {
  private static instance: UsageTracker;
  private usageFile: string;
  private statsFile: string;
  private config: UsageConfig;
  private cache: Map<string, UsageStats> = new Map();

  constructor(config?: Partial<UsageConfig>) {
    this.config = {
      retentionDays: 90,
      aggregationInterval: 5,
      alertThresholds: {
        errorRate: 10, // 10%
        latency: 5000, // 5 seconds
        requestsPerHour: 10000,
        bandwidthPerDay: 1024 * 1024 * 1024 // 1GB
      },
      rateLimits: {
        default: {
          requests: {
            perHour: 1000,
            perDay: 10000,
            perMonth: 100000
          },
          bandwidth: {
            perDay: 100 * 1024 * 1024 // 100MB
          }
        }
      },
      ...config
    };

    this.usageFile = path.join(process.cwd(), 'src/data/usage_logs.json');
    this.statsFile = path.join(process.cwd(), 'src/data/usage_stats.json');

    this.initialize();
  }

  static getInstance(config?: Partial<UsageConfig>): UsageTracker {
    if (!UsageTracker.instance) {
      UsageTracker.instance = new UsageTracker(config);
    }
    return UsageTracker.instance;
  }

  private async initialize() {
    await ensureFileExists(this.usageFile, []);
    await ensureFileExists(this.statsFile, {});
    
    // Start periodic aggregation
    setInterval(() => this.aggregateStats(), this.config.aggregationInterval * 60 * 1000);
    
    // Start daily cleanup
    setInterval(() => this.cleanup(), 24 * 60 * 60 * 1000);
  }

  /**
   * Track an API request
   */
  async trackRequest(record: Omit<UsageRecord, 'id' | 'timestamp'>): Promise<void> {
    const fullRecord: UsageRecord = {
      ...record,
      id: uuidv4(),
      timestamp: new Date()
    };

    try {
      // Append to usage log
      const logs = await readJsonFile<UsageRecord[]>(this.usageFile);
      logs.push(fullRecord);
      await writeJsonFile(this.usageFile, logs);

      // Update real-time stats
      this.updateRealtimeStats(fullRecord);

      // Check for alerts
      await this.checkAlerts(fullRecord);

      logger.debug('Usage tracked:', {
        userId: record.userId,
        apiKey: record.apiKey,
        endpoint: record.endpoint,
        statusCode: record.statusCode
      });
    } catch (error) {
      logger.error('Failed to track usage:', error);
    }
  }

  /**
   * Get usage statistics for a user
   */
  async getUserUsage(
    userId: string,
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<UserUsage> {
    const startTime = this.getStartTime(period);
    const logs = await this.getLogsInPeriod(startTime);
    const userLogs = logs.filter(log => log.userId === userId);

    const stats = this.calculateStats(userLogs);
    const limits = this.getRateLimits(userId);
    const usage = {
      requests: userLogs.length,
      bandwidth: stats.totalRequestSize + stats.totalResponseSize
    };

    return {
      userId,
      period,
      stats,
      limits,
      usage
    };
  }

  /**
   * Get usage statistics for an API key
   */
  async getApiKeyUsage(
    apiKey: string,
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<ApiKeyUsage> {
    const startTime = this.getStartTime(period);
    const logs = await this.getLogsInPeriod(startTime);
    const keyLogs = logs.filter(log => log.apiKey === apiKey);

    const stats = this.calculateStats(keyLogs);
    const limits = this.getRateLimits(undefined, apiKey);
    const usage = {
      requests: keyLogs.length,
      bandwidth: stats.totalRequestSize + stats.totalResponseSize
    };

    return {
      apiKey,
      period,
      stats,
      limits,
      usage
    };
  }

  /**
   * Get overall usage statistics
   */
  async getOverallStats(
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<UsageStats> {
    const startTime = this.getStartTime(period);
    const logs = await this.getLogsInPeriod(startTime);
    return this.calculateStats(logs);
  }

  /**
   * Get top users by usage
   */
  async getTopUsers(
    limit: number = 10,
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<Array<{ userId: string; requests: number; bandwidth: number }>> {
    const startTime = this.getStartTime(period);
    const logs = await this.getLogsInPeriod(startTime);

    const userStats = new Map<string, { requests: number; bandwidth: number }>();

    logs.forEach(log => {
      if (!log.userId) return;

      const current = userStats.get(log.userId) || { requests: 0, bandwidth: 0 };
      current.requests++;
      current.bandwidth += log.requestSize + log.responseSize;
      userStats.set(log.userId, current);
    });

    return Array.from(userStats.entries())
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, limit);
  }

  /**
   * Get endpoint statistics
   */
  async getEndpointStats(
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<Record<string, EndpointStats>> {
    const startTime = this.getStartTime(period);
    const logs = await this.getLogsInPeriod(startTime);
    const stats = this.calculateStats(logs);
    return stats.endpoints;
  }

  /**
   * Check rate limits for a user or API key
   */
  async checkRateLimit(
    userId?: string,
    apiKey?: string,
    endpoint?: string
  ): Promise<{ allowed: boolean; limit: number; remaining: number; resetAt: Date }> {
    const period = 'hour';
    const startTime = this.getStartTime(period);
    const logs = await this.getLogsInPeriod(startTime);

    const relevantLogs = logs.filter(log => {
      if (userId && log.userId !== userId) return false;
      if (apiKey && log.apiKey !== apiKey) return false;
      if (endpoint && log.endpoint !== endpoint) return false;
      return true;
    });

    const limits = this.getRateLimits(userId, apiKey);
    const limit = limits.requests.perHour || 1000;
    const used = relevantLogs.length;
    const remaining = Math.max(0, limit - used);

    return {
      allowed: remaining > 0,
      limit,
      remaining,
      resetAt: new Date(startTime.getTime() + 60 * 60 * 1000) // 1 hour from start
    };
  }

  /**
   * Calculate statistics from usage records
   */
  private calculateStats(logs: UsageRecord[]): UsageStats {
    const stats: UsageStats = {
      totalRequests: logs.length,
      successfulRequests: logs.filter(log => log.statusCode < 400).length,
      failedRequests: logs.filter(log => log.statusCode >= 400).length,
      totalResponseTime: logs.reduce((sum, log) => sum + log.responseTime, 0),
      totalRequestSize: logs.reduce((sum, log) => sum + log.requestSize, 0),
      totalResponseSize: logs.reduce((sum, log) => sum + log.responseSize, 0),
      endpoints: {},
      statusCodes: {},
      hourlyStats: []
    };

    // Calculate endpoint stats
    logs.forEach(log => {
      const endpoint = `${log.method} ${log.endpoint}`;
      
      if (!stats.endpoints[endpoint]) {
        stats.endpoints[endpoint] = {
          count: 0,
          averageResponseTime: 0,
          totalSize: 0,
          errors: 0
        };
      }

      const endpointStats = stats.endpoints[endpoint];
      endpointStats.count++;
      endpointStats.totalSize += log.requestSize + log.responseSize;
      endpointStats.averageResponseTime = 
        (endpointStats.averageResponseTime * (endpointStats.count - 1) + log.responseTime) / 
        endpointStats.count;
      
      if (log.statusCode >= 400) {
        endpointStats.errors++;
      }

      // Status code stats
      stats.statusCodes[log.statusCode] = (stats.statusCodes[log.statusCode] || 0) + 1;
    });

    // Calculate hourly stats
    const hourlyMap = new Map<string, { requests: number; errors: number; totalTime: number }>();
    
    logs.forEach(log => {
      const hour = new Date(log.timestamp).toISOString().slice(0, 13); // YYYY-MM-DDTHH
      const hourStats = hourlyMap.get(hour) || { requests: 0, errors: 0, totalTime: 0 };
      
      hourStats.requests++;
      hourStats.totalTime += log.responseTime;
      if (log.statusCode >= 400) {
        hourStats.errors++;
      }
      
      hourlyMap.set(hour, hourStats);
    });

    stats.hourlyStats = Array.from(hourlyMap.entries())
      .map(([hour, data]) => ({
        hour,
        requests: data.requests,
        errors: data.errors,
        averageResponseTime: data.totalTime / data.requests
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return stats;
  }

  /**
   * Get logs within a time period
   */
  private async getLogsInPeriod(startTime: Date): Promise<UsageRecord[]> {
    const logs = await readJsonFile<UsageRecord[]>(this.usageFile);
    return logs.filter(log => new Date(log.timestamp) >= startTime);
  }

  /**
   * Get start time for a period
   */
  private getStartTime(period: 'hour' | 'day' | 'week' | 'month'): Date {
    const now = new Date();
    
    switch (period) {
      case 'hour':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Get rate limits for a user or API key
   */
  private getRateLimits(userId?: string, apiKey?: string): RateLimitConfig {
    if (userId && this.config.rateLimits.perUser?.[userId]) {
      return this.config.rateLimits.perUser[userId];
    }
    
    if (apiKey && this.config.rateLimits.perApiKey?.[apiKey]) {
      return this.config.rateLimits.perApiKey[apiKey];
    }
    
    return this.config.rateLimits.default;
  }

  /**
   * Update real-time statistics
   */
  private updateRealtimeStats(record: UsageRecord): void {
    const key = record.userId || record.apiKey || 'anonymous';
    const stats = this.cache.get(key) || this.createEmptyStats();
    
    // Update stats
    stats.totalRequests++;
    if (record.statusCode < 400) {
      stats.successfulRequests++;
    } else {
      stats.failedRequests++;
    }
    
    stats.totalResponseTime += record.responseTime;
    stats.totalRequestSize += record.requestSize;
    stats.totalResponseSize += record.responseSize;
    
    this.cache.set(key, stats);
  }

  /**
   * Create empty stats object
   */
  private createEmptyStats(): UsageStats {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      totalRequestSize: 0,
      totalResponseSize: 0,
      endpoints: {},
      statusCodes: {},
      hourlyStats: []
    };
  }

  /**
   * Check for usage alerts
   */
  private async checkAlerts(record: UsageRecord): Promise<void> {
    // Check error rate
    const stats = await this.getUserUsage(record.userId || 'anonymous', 'hour');
    const errorRate = stats.stats.failedRequests / stats.stats.totalRequests * 100;
    
    if (errorRate > this.config.alertThresholds.errorRate) {
      logger.warn('High error rate detected', {
        userId: record.userId,
        errorRate: `${errorRate.toFixed(2)}%`
      });
    }
    
    // Check latency
    if (record.responseTime > this.config.alertThresholds.latency) {
      logger.warn('High latency detected', {
        endpoint: record.endpoint,
        latency: record.responseTime,
        threshold: this.config.alertThresholds.latency
      });
    }
  }

  /**
   * Aggregate statistics periodically
   */
  private async aggregateStats(): Promise<void> {
    try {
      const stats = await this.getOverallStats('hour');
      const currentStats = await readJsonFile<Record<string, any>>(this.statsFile);
      
      const hour = new Date().toISOString().slice(0, 13);
      currentStats[hour] = stats;
      
      await writeJsonFile(this.statsFile, currentStats);
      logger.debug('Usage statistics aggregated');
    } catch (error) {
      logger.error('Failed to aggregate stats:', error);
    }
  }

  /**
   * Clean up old usage logs
   */
  private async cleanup(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
      
      const logs = await readJsonFile<UsageRecord[]>(this.usageFile);
      const filteredLogs = logs.filter(log => 
        new Date(log.timestamp) > cutoffDate
      );
      
      if (filteredLogs.length < logs.length) {
        await writeJsonFile(this.usageFile, filteredLogs);
        logger.info(`Cleaned up ${logs.length - filteredLogs.length} old usage records`);
      }
    } catch (error) {
      logger.error('Failed to cleanup usage logs:', error);
    }
  }
}

// Export singleton instance
export const usageTracker = UsageTracker.getInstance();
