import { Router, Request, Response } from 'express';
import { getPoolStats } from '../utils/db';
import { cacheService } from '../services/cacheService';
import { adminAuth } from '../middleware/auth';
import { query } from '../utils/db';

const router = Router();

/**
 * Performance Monitoring Endpoint
 * Provides real-time stats on database, cache, and system performance
 */
router.get('/', adminAuth, async (req: Request, res: Response) => {
  try {
    // Get database pool statistics
    const poolStats = getPoolStats();

    // Get cache statistics
    const cacheStats = cacheService.getStats();

    // Get memory usage
    const memUsage = process.memoryUsage();

    // Test database query performance
    let queryPerformance = null;
    try {
      const start = Date.now();
      await query('SELECT 1 as test');
      queryPerformance = Date.now() - start;
    } catch (error) {
      queryPerformance = -1;
    }

    // Get index statistics (check if our performance indexes exist)
    let indexStats = { total: 0, performance: 0 };
    try {
      const indexResult = await query(`
        SELECT COUNT(*) as count
        FROM pg_indexes
        WHERE schemaname = 'public'
      `);
      indexStats.total = indexResult.rows[0].count;

      const perfIndexResult = await query(`
        SELECT COUNT(*) as count
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
      `);
      indexStats.performance = perfIndexResult.rows[0].count;
    } catch (error) {
      // Ignore index check errors
    }

    const stats = {
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: process.uptime(),
        formatted: formatUptime(process.uptime())
      },
      database: {
        pool: {
          ...poolStats,
          utilizationPercent: Math.round((poolStats.active / 20) * 100)
        },
        querySpeed: queryPerformance,
        indexes: indexStats,
        status: poolStats.idle > 0 ? 'healthy' : poolStats.waiting > 5 ? 'overloaded' : 'busy'
      },
      cache: {
        ...cacheStats,
        hitRateFormatted: `${cacheStats.hitRate}%`,
        status: cacheService.isAvailable() ? 'available' : 'unavailable'
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        unit: 'MB',
        utilizationPercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      performance: {
        recommendations: getRecommendations(poolStats, cacheStats, indexStats)
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('Performance monitor error:', error);
    res.status(500).json({
      error: 'Failed to get performance stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const dbHealthy = await checkDatabaseHealth();
    const cacheHealthy = cacheService.isAvailable();

    const health = {
      status: dbHealthy && cacheHealthy ? 'healthy' : 'degraded',
      checks: {
        database: dbHealthy,
        cache: cacheHealthy,
        memory: process.memoryUsage().heapUsed < (process.memoryUsage().heapTotal * 0.9)
      },
      timestamp: new Date().toISOString()
    };

    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Health check failed'
    });
  }
});

// Helper functions
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await query('SELECT 1 as health');
    return result.rows[0]?.health === 1;
  } catch {
    return false;
  }
}

function getRecommendations(poolStats: any, cacheStats: any, indexStats: any): string[] {
  const recommendations: string[] = [];

  // Database pool recommendations
  if (poolStats.waiting > 0) {
    recommendations.push('High database connection demand - consider increasing pool size');
  }
  if (poolStats.active > 15) {
    recommendations.push('Database pool near capacity - optimize queries or scale database');
  }

  // Cache recommendations
  if (!cacheService.isAvailable()) {
    recommendations.push('Cache not available - add REDIS_URL to environment');
  } else if (cacheStats.hitRate < 50) {
    recommendations.push('Low cache hit rate - review caching strategy');
  }

  // Index recommendations
  if (indexStats.performance === 0) {
    recommendations.push('Performance indexes not applied - run migration 231');
  }

  // Memory recommendations
  const memUsage = process.memoryUsage();
  if (memUsage.heapUsed > memUsage.heapTotal * 0.8) {
    recommendations.push('High memory usage - consider scaling or optimizing');
  }

  if (recommendations.length === 0) {
    recommendations.push('All systems operating optimally');
  }

  return recommendations;
}

export default router;