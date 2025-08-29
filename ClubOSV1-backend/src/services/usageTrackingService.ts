import db from '../utils/db-consolidated';
import { logger } from '../utils/logger';
import { cacheService } from './cacheService';

interface UsageEntry {
  user_id: number;
  endpoint: string;
  model?: string;
  tokens_used?: number;
  cost?: number;
  response_time_ms?: number;
  cache_hit?: boolean;
  error?: string;
  metadata?: any;
}

interface UsageStats {
  total_requests: number;
  total_tokens: number;
  total_cost: number;
  avg_response_time: number;
  cache_hit_rate: number;
  error_rate: number;
}

interface ModelCosts {
  [key: string]: {
    input: number;  // Cost per 1K tokens
    output: number; // Cost per 1K tokens
  };
}

class UsageTrackingService {
  private static instance: UsageTrackingService;
  
  // OpenAI pricing as of 2024
  private modelCosts: ModelCosts = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
  };

  private constructor() {
    this.initializeTable();
  }

  static getInstance(): UsageTrackingService {
    if (!UsageTrackingService.instance) {
      UsageTrackingService.instance = new UsageTrackingService();
    }
    return UsageTrackingService.instance;
  }

  private async initializeTable() {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS api_usage (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          endpoint VARCHAR(255) NOT NULL,
          method VARCHAR(10),
          model VARCHAR(50),
          tokens_used INTEGER,
          cost DECIMAL(10, 6),
          response_time_ms INTEGER,
          cache_hit BOOLEAN DEFAULT false,
          error TEXT,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          -- Indexes for performance
          INDEX idx_usage_user_id (user_id),
          INDEX idx_usage_endpoint (endpoint),
          INDEX idx_usage_created_at (created_at),
          INDEX idx_usage_model (model)
        )
      `);

      // Create daily aggregation table
      await db.query(`
        CREATE TABLE IF NOT EXISTS api_usage_daily (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL,
          user_id INTEGER,
          endpoint VARCHAR(255),
          model VARCHAR(50),
          total_requests INTEGER DEFAULT 0,
          total_tokens INTEGER DEFAULT 0,
          total_cost DECIMAL(10, 4) DEFAULT 0,
          avg_response_time_ms INTEGER,
          cache_hits INTEGER DEFAULT 0,
          errors INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          UNIQUE(date, user_id, endpoint, model)
        )
      `);

      // Create indexes for daily table separately
      await db.query(`CREATE INDEX IF NOT EXISTS idx_daily_date ON api_usage_daily(date)`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_daily_user ON api_usage_daily(user_id)`);

      logger.info('Usage tracking tables initialized');
    } catch (error: any) {
      // Log error but don't crash the service
      logger.error('Failed to initialize usage tracking tables:', error);
      // If it's just the indexes that failed, the tables might still work
      if (error.code !== '42P07') { // 42P07 = relation already exists
        // Only log critical errors
        logger.warn('Usage tracking may have limited functionality');
      }
    }
  }

  /**
   * Track API usage
   */
  async trackUsage(usage: UsageEntry): Promise<void> {
    try {
      // Calculate cost if tokens are provided
      let cost = usage.cost;
      if (!cost && usage.tokens_used && usage.model) {
        cost = this.calculateCost(usage.model, usage.tokens_used);
      }

      // Insert into database
      await db.query(
        `INSERT INTO api_usage (
          user_id, endpoint, model, tokens_used, cost, 
          response_time_ms, cache_hit, error, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          usage.user_id,
          usage.endpoint,
          usage.model,
          usage.tokens_used,
          cost,
          usage.response_time_ms,
          usage.cache_hit || false,
          usage.error,
          JSON.stringify(usage.metadata || {})
        ]
      );

      // Update daily aggregation (async, don't wait)
      this.updateDailyAggregation(usage, cost).catch(err => 
        logger.error('Failed to update daily aggregation:', err)
      );

      // Clear cache for user stats
      await cacheService.delete(`usage:stats:${usage.user_id}`);
      
    } catch (error) {
      logger.error('Failed to track usage:', error);
    }
  }

  /**
   * Calculate cost based on model and tokens
   */
  private calculateCost(model: string, tokens: number): number {
    const modelCost = this.modelCosts[model] || this.modelCosts['gpt-3.5-turbo'];
    // Assuming 50% input, 50% output ratio (adjust based on your usage)
    const inputTokens = tokens * 0.5;
    const outputTokens = tokens * 0.5;
    
    const cost = (inputTokens * modelCost.input / 1000) + 
                 (outputTokens * modelCost.output / 1000);
    
    return Math.round(cost * 1000000) / 1000000; // Round to 6 decimal places
  }

  /**
   * Update daily aggregation table
   */
  private async updateDailyAggregation(usage: UsageEntry, cost?: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    await db.query(`
      INSERT INTO api_usage_daily (
        date, user_id, endpoint, model, 
        total_requests, total_tokens, total_cost, 
        avg_response_time_ms, cache_hits, errors
      ) VALUES (
        $1, $2, $3, $4, 1, $5, $6, $7, $8, $9
      )
      ON CONFLICT (date, user_id, endpoint, model) 
      DO UPDATE SET
        total_requests = api_usage_daily.total_requests + 1,
        total_tokens = api_usage_daily.total_tokens + COALESCE($5, 0),
        total_cost = api_usage_daily.total_cost + COALESCE($6, 0),
        avg_response_time_ms = (
          (api_usage_daily.avg_response_time_ms * api_usage_daily.total_requests + COALESCE($7, 0)) / 
          (api_usage_daily.total_requests + 1)
        ),
        cache_hits = api_usage_daily.cache_hits + CASE WHEN $8 THEN 1 ELSE 0 END,
        errors = api_usage_daily.errors + CASE WHEN $9 IS NOT NULL THEN 1 ELSE 0 END
    `, [
      today,
      usage.user_id,
      usage.endpoint,
      usage.model,
      usage.tokens_used || 0,
      cost || 0,
      usage.response_time_ms || 0,
      usage.cache_hit || false,
      usage.error
    ]);
  }

  /**
   * Get usage statistics for a user
   */
  async getUserStats(userId: number, days: number = 30): Promise<UsageStats> {
    const cacheKey = `usage:stats:${userId}:${days}`;
    
    return cacheService.withCache(cacheKey, async () => {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_requests,
          COALESCE(SUM(tokens_used), 0) as total_tokens,
          COALESCE(SUM(cost), 0) as total_cost,
          COALESCE(AVG(response_time_ms), 0) as avg_response_time,
          COALESCE(SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100, 0) as cache_hit_rate,
          COALESCE(SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100, 0) as error_rate
        FROM api_usage
        WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '${days} days'
      `, [userId]);

      return result.rows[0] || {
        total_requests: 0,
        total_tokens: 0,
        total_cost: 0,
        avg_response_time: 0,
        cache_hit_rate: 0,
        error_rate: 0
      };
    }, { ttl: 300 }); // Cache for 5 minutes
  }

  /**
   * Get system-wide usage statistics
   */
  async getSystemStats(days: number = 30): Promise<any> {
    const cacheKey = `usage:system:${days}`;
    
    return cacheService.withCache(cacheKey, async () => {
      // Overall stats
      const overall = await db.query(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(DISTINCT user_id) as unique_users,
          COALESCE(SUM(tokens_used), 0) as total_tokens,
          COALESCE(SUM(cost), 0) as total_cost,
          COALESCE(AVG(response_time_ms), 0) as avg_response_time,
          COALESCE(SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100, 0) as cache_hit_rate
        FROM api_usage
        WHERE created_at >= NOW() - INTERVAL '${days} days'
      `);

      // By endpoint
      const byEndpoint = await db.query(`
        SELECT 
          endpoint,
          COUNT(*) as requests,
          COALESCE(SUM(cost), 0) as cost,
          COALESCE(AVG(response_time_ms), 0) as avg_response_time
        FROM api_usage
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY endpoint
        ORDER BY requests DESC
        LIMIT 10
      `);

      // By model
      const byModel = await db.query(`
        SELECT 
          model,
          COUNT(*) as requests,
          COALESCE(SUM(tokens_used), 0) as tokens,
          COALESCE(SUM(cost), 0) as cost
        FROM api_usage
        WHERE model IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY model
        ORDER BY cost DESC
      `);

      // Top users
      const topUsers = await db.query(`
        SELECT 
          u.user_id,
          usr.username,
          COUNT(*) as requests,
          COALESCE(SUM(u.cost), 0) as total_cost
        FROM api_usage u
        LEFT JOIN users usr ON u.user_id = usr.id
        WHERE u.created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY u.user_id, usr.username
        ORDER BY total_cost DESC
        LIMIT 10
      `);

      return {
        overall: overall.rows[0],
        byEndpoint: byEndpoint.rows,
        byModel: byModel.rows,
        topUsers: topUsers.rows,
        cacheStats: cacheService.getStats()
      };
    }, { ttl: 600 }); // Cache for 10 minutes
  }

  /**
   * Check if user has exceeded rate limits
   */
  async checkRateLimit(userId: number, limit: number = 100): Promise<boolean> {
    const result = await db.query(`
      SELECT COUNT(*) as request_count
      FROM api_usage
      WHERE user_id = $1
      AND created_at >= NOW() - INTERVAL '1 hour'
    `, [userId]);

    return result.rows[0].request_count < limit;
  }

  /**
   * Get cost projection for current month
   */
  async getMonthlyProjection(): Promise<number> {
    const result = await db.query(`
      SELECT 
        SUM(cost) as month_cost,
        EXTRACT(DAY FROM NOW()) as days_elapsed
      FROM api_usage
      WHERE created_at >= DATE_TRUNC('month', NOW())
    `);

    const { month_cost, days_elapsed } = result.rows[0];
    if (!month_cost || !days_elapsed) return 0;

    const daysInMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    ).getDate();

    return (month_cost / days_elapsed) * daysInMonth;
  }

  /**
   * Middleware for Express routes
   */
  trackingMiddleware() {
    return async (req: any, res: any, next: any) => {
      const startTime = Date.now();
      const originalSend = res.send;

      // Track response
      res.send = function(body: any) {
        res.send = originalSend;
        
        const responseTime = Date.now() - startTime;
        const userId = req.user?.id;
        
        // Track usage async (don't block response)
        usageTrackingService.trackUsage({
          user_id: userId,
          endpoint: req.path,
          response_time_ms: responseTime,
          cache_hit: res.locals.cacheHit || false,
          metadata: {
            method: req.method,
            status: res.statusCode,
            ip: req.ip
          }
        }).catch(err => logger.error('Usage tracking failed:', err));

        return res.send(body);
      };

      next();
    };
  }
}

// Export singleton instance
export const usageTrackingService = UsageTrackingService.getInstance();

// Export types
export { UsageEntry, UsageStats };