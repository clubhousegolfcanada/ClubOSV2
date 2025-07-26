import { logger } from '../../utils/logger';
import { db } from '../../utils/database';

interface UsageData {
  [key: string]: {
    count: number;
    lastUsed: string;
    totalTokens?: number;
  };
}

interface DailyUsage {
  [date: string]: {
    [provider: string]: {
      requests: number;
      tokens: number;
      cost: number;
    };
  };
}

export class UsageTracker {
  private static instance: UsageTracker;
  private usageData: UsageData = {};
  private dailyUsage: DailyUsage = {};
  private initialized = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): UsageTracker {
    if (!UsageTracker.instance) {
      UsageTracker.instance = new UsageTracker();
    }
    return UsageTracker.instance;
  }

  private async initialize() {
    try {
      // Initialize from database if needed
      // For now, just use in-memory storage
      this.initialized = true;
      logger.info('Usage tracker initialized');
    } catch (error) {
      logger.error('Failed to initialize usage tracker:', error);
    }
  }

  async trackUsage(endpoint: string, tokens?: number) {
    try {
      const now = new Date().toISOString();
      
      if (!this.usageData[endpoint]) {
        this.usageData[endpoint] = {
          count: 0,
          lastUsed: now,
          totalTokens: 0
        };
      }
      
      this.usageData[endpoint].count++;
      this.usageData[endpoint].lastUsed = now;
      
      if (tokens) {
        this.usageData[endpoint].totalTokens = (this.usageData[endpoint].totalTokens || 0) + tokens;
      }
      
      // Log to database asynchronously
      this.logToDatabase(endpoint, tokens).catch(err => 
        logger.error('Failed to log usage to database:', err)
      );
    } catch (error) {
      logger.error('Failed to track usage:', error);
    }
  }

  private async logToDatabase(endpoint: string, tokens?: number) {
    try {
      // Store in request_logs or create a new usage_logs table
      await db.logRequest({
        method: 'POST',
        path: endpoint,
        status_code: 200,
        response_time: 0,
        user_id: undefined,
        ip_address: 'system',
        user_agent: 'usage-tracker',
        error: null
      });
    } catch (error) {
      logger.error('Failed to log usage to database:', error);
    }
  }

  async trackDailyUsage(provider: string, tokens: number, cost: number) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      if (!this.dailyUsage[today]) {
        this.dailyUsage[today] = {};
      }
      
      if (!this.dailyUsage[today][provider]) {
        this.dailyUsage[today][provider] = {
          requests: 0,
          tokens: 0,
          cost: 0
        };
      }
      
      this.dailyUsage[today][provider].requests++;
      this.dailyUsage[today][provider].tokens += tokens;
      this.dailyUsage[today][provider].cost += cost;
    } catch (error) {
      logger.error('Failed to track daily usage:', error);
    }
  }

  getUsageStats() {
    return {
      endpoints: this.usageData,
      daily: this.dailyUsage,
      summary: this.getSummary()
    };
  }

  private getSummary() {
    const totalRequests = Object.values(this.usageData).reduce((sum, data) => sum + data.count, 0);
    const totalTokens = Object.values(this.usageData).reduce((sum, data) => sum + (data.totalTokens || 0), 0);
    
    return {
      totalRequests,
      totalTokens,
      uniqueEndpoints: Object.keys(this.usageData).length,
      lastActivity: this.getLastActivity()
    };
  }

  private getLastActivity() {
    let lastActivity = '';
    for (const [endpoint, data] of Object.entries(this.usageData)) {
      if (!lastActivity || data.lastUsed > lastActivity) {
        lastActivity = data.lastUsed;
      }
    }
    return lastActivity;
  }

  async getRateLimitStatus(identifier: string) {
    // Simple in-memory rate limiting
    const window = 15 * 60 * 1000; // 15 minutes
    const now = Date.now();
    const key = `ratelimit:${identifier}`;
    
    // This would need to be stored in Redis or database for production
    return {
      allowed: true,
      remaining: 100,
      reset: new Date(now + window)
    };
  }

  async cleanup() {
    // Cleanup old data periodically
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    for (const date in this.dailyUsage) {
      if (new Date(date) < thirtyDaysAgo) {
        delete this.dailyUsage[date];
      }
    }
  }
}

export const usageTracker = UsageTracker.getInstance();
