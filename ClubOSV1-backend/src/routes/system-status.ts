import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { pool } from '../utils/db';

const router = Router();

// Get comprehensive system status
router.get('/all', authenticate, async (req: Request, res: Response) => {
  try {
    const status: any = {
      timestamp: new Date().toISOString(),
      services: {},
      database: {},
      integrations: {},
      health: {}
    };

    // Check database connectivity
    try {
      const dbCheck = await pool.query('SELECT NOW() as time, COUNT(*) as connections FROM pg_stat_activity');
      status.database = {
        connected: true,
        time: dbCheck.rows[0]?.time,
        activeConnections: parseInt(dbCheck.rows[0]?.connections || '0')
      };
    } catch (error) {
      status.database = {
        connected: false,
        error: 'Database connection failed'
      };
    }

    // Check UniFi Access configuration
    const unifiConfigured = !!(
      process.env.DARTMOUTH_ACCESS_TOKEN || 
      process.env.BEDFORD_ACCESS_TOKEN ||
      process.env.UNIFI_ACCESS_TOKEN
    );
    
    status.integrations.unifiAccess = {
      configured: unifiConfigured,
      usingCloudProxy: process.env.UNIFI_USE_REMOTE_ACCESS === 'true',
      locations: {
        dartmouth: !!process.env.DARTMOUTH_ACCESS_TOKEN,
        bedford: !!process.env.BEDFORD_ACCESS_TOKEN
      }
    };

    // Check OpenAI configuration
    status.integrations.openai = {
      configured: !!process.env.OPENAI_API_KEY,
      assistants: {
        booking: !!process.env.BOOKING_ACCESS_GPT_ID,
        emergency: !!process.env.EMERGENCY_GPT_ID,
        techSupport: !!process.env.TECH_SUPPORT_GPT_ID,
        brand: !!process.env.BRAND_MARKETING_GPT_ID
      }
    };

    // Check Slack configuration
    status.integrations.slack = {
      configured: !!process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_CHANNEL || 'Not configured'
    };

    // Check OpenPhone configuration
    status.integrations.openphone = {
      configured: !!(process.env.OPENPHONE_API_KEY || process.env.HUBSPOT_API_KEY),
      hubspotIntegration: !!process.env.HUBSPOT_API_KEY
    };

    // Check NinjaOne configuration
    status.integrations.ninjaone = {
      configured: !!(process.env.NINJAONE_CLIENT_ID && process.env.NINJAONE_CLIENT_SECRET)
    };

    // Service health checks
    status.services = {
      api: 'operational',
      authentication: 'operational',
      messaging: 'operational',
      aiAutomation: process.env.OPENAI_API_KEY ? 'operational' : 'degraded'
    };

    // Overall health
    const criticalServices = [
      status.database.connected,
      status.integrations.openai.configured
    ];
    
    status.health = {
      status: criticalServices.every(s => s) ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    };

    res.json({
      success: true,
      data: status
    });

  } catch (error: any) {
    logger.error('System status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system status',
      message: error.message
    });
  }
});

// Simple health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Quick database check
    let dbHealthy = false;
    try {
      await pool.query('SELECT 1');
      dbHealthy = true;
    } catch (error) {
      dbHealthy = false;
    }

    res.json({
      success: true,
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Get specific service status
router.get('/:service', authenticate, async (req: Request, res: Response) => {
  try {
    const { service } = req.params;
    let serviceStatus: any = {};

    switch (service) {
      case 'database':
        try {
          const result = await pool.query(`
            SELECT 
              COUNT(*) as total_connections,
              COUNT(*) FILTER (WHERE state = 'active') as active_queries,
              MAX(query_start) as last_query_time
            FROM pg_stat_activity
            WHERE datname = current_database()
          `);
          
          serviceStatus = {
            connected: true,
            stats: result.rows[0],
            poolSize: pool.totalCount,
            idleConnections: pool.idleCount,
            waitingClients: pool.waitingCount
          };
        } catch (error) {
          serviceStatus = {
            connected: false,
            error: 'Database check failed'
          };
        }
        break;

      case 'unifi':
        serviceStatus = {
          configured: !!(process.env.DARTMOUTH_ACCESS_TOKEN || process.env.UNIFI_ACCESS_TOKEN),
          mode: process.env.UNIFI_USE_REMOTE_ACCESS === 'true' ? 'cloud-proxy' : 'direct',
          locations: {
            dartmouth: {
              configured: !!process.env.DARTMOUTH_ACCESS_TOKEN,
              ip: process.env.DARTMOUTH_CONTROLLER_IP
            },
            bedford: {
              configured: !!process.env.BEDFORD_ACCESS_TOKEN,
              ip: process.env.BEDFORD_CONTROLLER_IP
            }
          }
        };
        break;

      case 'openai':
        serviceStatus = {
          configured: !!process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || 'gpt-4o',
          assistants: {
            booking: process.env.BOOKING_ACCESS_GPT_ID ? 'configured' : 'not configured',
            emergency: process.env.EMERGENCY_GPT_ID ? 'configured' : 'not configured',
            techSupport: process.env.TECH_SUPPORT_GPT_ID ? 'configured' : 'not configured',
            brand: process.env.BRAND_MARKETING_GPT_ID ? 'configured' : 'not configured'
          }
        };
        break;

      case 'slack':
        serviceStatus = {
          configured: !!process.env.SLACK_WEBHOOK_URL,
          channel: process.env.SLACK_CHANNEL || 'not configured',
          facilitiesChannel: process.env.FACILITIES_SLACK_CHANNEL || 'not configured'
        };
        break;

      default:
        return res.status(404).json({
          success: false,
          error: `Service '${service}' not found`
        });
    }

    res.json({
      success: true,
      service,
      status: serviceStatus
    });

  } catch (error: any) {
    logger.error(`Service status check failed for ${req.params.service}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service status',
      message: error.message
    });
  }
});

export default router;