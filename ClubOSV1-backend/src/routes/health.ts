import { Router, Request, Response } from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger';
import { readJsonFile } from '../utils/fileUtils';

const router = Router();

// Comprehensive health check
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
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
      services: {
        database: 'json-files', // Will be 'connected' when using real DB
        jwt: !!process.env.JWT_SECRET,
        rateLimiting: process.env.RATE_LIMIT_ENABLED === 'true'
      },
      checks: await runHealthChecks()
    };

    res.json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Detailed health check
router.get('/health/detailed', async (req: Request, res: Response) => {
  try {
    const dataDir = path.join(process.cwd(), 'src', 'data');
    
    // Check data files
    const fileChecks = await Promise.all([
      checkFile('users.json'),
      checkFile('authLogs.json'),
      checkFile('systemConfig.json'),
      checkFile('logs/requests.json')
    ]);

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      dataFiles: fileChecks,
      configuration: {
        jwtConfigured: !!process.env.JWT_SECRET,
        portConfigured: !!process.env.PORT,
        frontendUrlConfigured: !!process.env.FRONTEND_URL,
        nodeEnv: process.env.NODE_ENV
      },
      statistics: await getSystemStats()
    };

    res.json(health);
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Detailed health check failed'
    });
  }
});

// Helper functions
async function runHealthChecks(): Promise<any> {
  const checks: any = {};

  // Check if data directory exists
  try {
    const dataDir = path.join(process.cwd(), 'src', 'data');
    await fs.access(dataDir);
    checks.dataDirectory = 'accessible';
  } catch {
    checks.dataDirectory = 'not accessible';
  }

  // Check if we can read users
  try {
    const users = await readJsonFile<any[]>('users.json');
    checks.usersFile = `${users.length} users`;
  } catch {
    checks.usersFile = 'error';
  }

  // Check if logs directory is writable
  try {
    const logsDir = path.join(process.cwd(), 'src', 'data', 'logs');
    await fs.access(logsDir, fs.constants.W_OK);
    checks.logsWritable = true;
  } catch {
    checks.logsWritable = false;
  }

  return checks;
}

async function checkFile(filename: string): Promise<any> {
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', filename);
    const stats = await fs.stat(filePath);
    const content = await fs.readFile(filePath, 'utf-8');
    
    let isValidJson = true;
    let recordCount = 0;
    
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        recordCount = parsed.length;
      }
    } catch {
      isValidJson = false;
    }

    return {
      name: filename,
      exists: true,
      size: stats.size,
      modified: stats.mtime,
      isValidJson,
      recordCount
    };
  } catch (error) {
    return {
      name: filename,
      exists: false,
      error: error.message
    };
  }
}

async function getSystemStats(): Promise<any> {
  try {
    const [users, authLogs] = await Promise.all([
      readJsonFile<any[]>('users.json').catch(() => []),
      readJsonFile<any[]>('authLogs.json').catch(() => [])
    ]);

    const recentLogins = authLogs
      .filter(log => log.action === 'login')
      .filter(log => new Date(log.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000))
      .length;

    return {
      totalUsers: users.length,
      totalAuthLogs: authLogs.length,
      recentLogins24h: recentLogins
    };
  } catch {
    return {
      error: 'Could not fetch statistics'
    };
  }
}

export default router;
