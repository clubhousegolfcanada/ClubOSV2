import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { getPoolStats } from '../utils/db';
import os from 'os';

// Performance metrics storage
interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
  userId?: string;
}

const requestMetrics: RequestMetrics[] = [];
const MAX_METRICS_HISTORY = 1000;

// Get system metrics
function getSystemMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(2);
  
  const cpus = os.cpus();
  const cpuUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    return acc + ((total - idle) / total) * 100;
  }, 0) / cpus.length;
  
  return {
    memory: {
      total: Math.round(totalMem / 1024 / 1024), // MB
      used: Math.round(usedMem / 1024 / 1024), // MB
      free: Math.round(freeMem / 1024 / 1024), // MB
      percentage: parseFloat(memUsagePercent)
    },
    cpu: {
      cores: cpus.length,
      usage: cpuUsage.toFixed(2)
    },
    uptime: Math.round(process.uptime())
  };
}

// Request performance logging middleware
export const performanceLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
  
  // Log request start
  logger.debug(`[${requestId}] ${req.method} ${req.path} - Started`, {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    userId: req.user?.id
  });
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args: any[]): any {
    const duration = Date.now() - start;
    
    // Store metrics
    const metrics: RequestMetrics = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date(),
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      userId: req.user?.id
    };
    
    requestMetrics.push(metrics);
    if (requestMetrics.length > MAX_METRICS_HISTORY) {
      requestMetrics.shift();
    }
    
    // Log performance data
    const logData = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id
    };
    
    // Different log levels based on performance
    if (duration > 3000) {
      logger.warn(`[${requestId}] Extremely slow request`, logData);
    } else if (duration > 1000) {
      logger.info(`[${requestId}] Slow request`, logData);
    } else if (res.statusCode >= 400) {
      logger.info(`[${requestId}] Request failed`, logData);
    } else {
      logger.debug(`[${requestId}] Request completed`, logData);
    }
    
    // Call original end
    return originalEnd.apply(res, args);
  };
  
  next();
};

// Endpoint to get performance stats
export const getPerformanceStats = async (req: Request, res: Response) => {
  try {
    // Calculate request statistics
    const totalRequests = requestMetrics.length;
    const avgDuration = totalRequests > 0 
      ? Math.round(requestMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests)
      : 0;
    
    const slowRequests = requestMetrics.filter(m => m.duration > 1000).length;
    const failedRequests = requestMetrics.filter(m => m.statusCode >= 400).length;
    
    // Group by endpoint
    const endpointStats = requestMetrics.reduce((acc: any, m) => {
      const key = `${m.method} ${m.path}`;
      if (!acc[key]) {
        acc[key] = { count: 0, totalDuration: 0, failures: 0 };
      }
      acc[key].count++;
      acc[key].totalDuration += m.duration;
      if (m.statusCode >= 400) {
        acc[key].failures++;
      }
      return acc;
    }, {});
    
    // Get top 10 slowest endpoints
    const slowestEndpoints = Object.entries(endpointStats)
      .map(([endpoint, stats]: [string, any]) => ({
        endpoint,
        avgDuration: Math.round(stats.totalDuration / stats.count),
        count: stats.count,
        failureRate: ((stats.failures / stats.count) * 100).toFixed(2)
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);
    
    // Get database stats
    const dbStats = getPoolStats();
    
    // Get system metrics
    const systemMetrics = getSystemMetrics();
    
    res.json({
      success: true,
      data: {
        timestamp: new Date(),
        requests: {
          total: totalRequests,
          avgDuration,
          slowRequests,
          slowRequestPercentage: totalRequests > 0 
            ? ((slowRequests / totalRequests) * 100).toFixed(2)
            : 0,
          failedRequests,
          failureRate: totalRequests > 0 
            ? ((failedRequests / totalRequests) * 100).toFixed(2)
            : 0,
          slowestEndpoints
        },
        database: dbStats,
        system: systemMetrics,
        recentRequests: requestMetrics.slice(-20).map(m => ({
          method: m.method,
          path: m.path,
          status: m.statusCode,
          duration: m.duration,
          timestamp: m.timestamp
        }))
      }
    });
  } catch (error) {
    logger.error('Failed to get performance stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance statistics'
    });
  }
};

// Memory leak detection
let lastHeapUsed = 0;
let heapGrowthCount = 0;

export const memoryMonitor = () => {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsed = Math.round(memUsage.heapUsed / 1024 / 1024); // MB
    
    // Check for consistent memory growth
    if (heapUsed > lastHeapUsed + 50) { // 50MB growth
      heapGrowthCount++;
      
      if (heapGrowthCount > 5) { // 5 consecutive growth periods
        logger.warn('Potential memory leak detected', {
          heapUsed,
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024)
        });
      }
    } else {
      heapGrowthCount = 0;
    }
    
    lastHeapUsed = heapUsed;
  }, 60000); // Check every minute
};

// Start memory monitoring
memoryMonitor();