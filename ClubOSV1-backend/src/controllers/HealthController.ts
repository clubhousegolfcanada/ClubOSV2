import { Request, Response } from 'express';
import { BaseController } from '../utils/BaseController';
import os from 'os';
import { pool } from '../utils/db';
import { logger } from '../utils/logger';

/**
 * Health check controller using new architecture patterns
 * Demonstrates usage of BaseController and ApiResponse
 */
export class HealthController extends BaseController {
  /**
   * GET /api/health
   * Basic health check endpoint
   */
  healthCheck = this.handle(async (req: Request, res: Response) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.15.0',
        system: {
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          memory: {
            total: os.totalmem(),
            free: os.freemem(),
            usage: process.memoryUsage()
          },
          cpu: {
            model: os.cpus()[0]?.model,
            cores: os.cpus().length,
            loadAverage: os.loadavg()
          }
        },
        services: await this.checkServices()
      };

      return this.ok(res, health, 'System is healthy');
    } catch (error) {
      logger.error('Health check failed:', error);
      return this.serverError(res, error);
    }
  });

  /**
   * GET /api/health/detailed
   * Detailed health check with database connectivity
   */
  detailedHealthCheck = this.handle(async (req: Request, res: Response) => {
    try {
      const [dbHealth, serviceHealth] = await Promise.all([
        this.checkDatabase(),
        this.checkServices()
      ]);

      const health = {
        status: dbHealth.connected ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbHealth,
        services: serviceHealth,
        configuration: {
          jwtConfigured: !!process.env.JWT_SECRET,
          portConfigured: !!process.env.PORT,
          frontendUrlConfigured: !!process.env.FRONTEND_URL,
          openAIConfigured: !!process.env.OPENAI_API_KEY,
          slackConfigured: !!process.env.SLACK_WEBHOOK_URL,
          nodeEnv: process.env.NODE_ENV
        },
        statistics: await this.getSystemStats()
      };

      if (!dbHealth.connected) {
        return res.status(503).json({
          success: false,
          message: 'Database connection unhealthy',
          data: health,
          timestamp: new Date().toISOString()
        });
      }

      return this.ok(res, health, 'Detailed health check complete');
    } catch (error) {
      logger.error('Detailed health check failed:', error);
      return this.serverError(res, error);
    }
  });

  /**
   * Check database connectivity
   */
  private async checkDatabase() {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      
      return {
        connected: true,
        responseTime: result.rows[0].now,
        poolStats: {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount
        }
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Check external services
   */
  private async checkServices() {
    const services: any = {
      database: 'checking',
      jwt: !!process.env.JWT_SECRET,
      rateLimiting: process.env.RATE_LIMIT_ENABLED === 'true',
      openAI: !!process.env.OPENAI_API_KEY,
      openPhone: !!process.env.OPENPHONE_API_KEY,
      slack: !!process.env.SLACK_WEBHOOK_URL
    };

    // Check database
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      services.database = 'connected';
    } catch {
      services.database = 'disconnected';
    }

    return services;
  }

  /**
   * Get system statistics
   */
  private async getSystemStats() {
    try {
      const client = await pool.connect();
      
      const [userCount, ticketCount, messageCount] = await Promise.all([
        client.query('SELECT COUNT(*) FROM users'),
        client.query('SELECT COUNT(*) FROM tickets'),
        client.query('SELECT COUNT(*) FROM messages')
      ]);
      
      const recentLogins = await client.query(
        'SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL \'24 hours\''
      );
      
      client.release();
      
      return {
        totalUsers: parseInt(userCount.rows[0].count),
        totalTickets: parseInt(ticketCount.rows[0].count),
        totalMessages: parseInt(messageCount.rows[0].count),
        recentLogins24h: parseInt(recentLogins.rows[0].count)
      };
    } catch (error) {
      logger.error('Failed to get system stats:', error);
      return {
        error: 'Could not fetch statistics'
      };
    }
  }
}