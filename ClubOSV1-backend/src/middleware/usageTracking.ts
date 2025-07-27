import { Request, Response, NextFunction } from 'express';
import { usageTracker } from '../services/usage/UsageTracker';
import { logger } from '../utils/logger';

interface RequestWithUsage extends Request {
  startTime?: number;
  requestSize?: number;
  userId?: string;
  apiKey?: string;
}

/**
 * Middleware to track API usage
 */
export function trackUsage(req: RequestWithUsage, res: Response, next: NextFunction) {
  // Record start time
  req.startTime = Date.now();

  // Calculate request size
  req.requestSize = 0;
  if (req.headers['content-length']) {
    req.requestSize = parseInt(req.headers['content-length']);
  } else if (req.body) {
    req.requestSize = JSON.stringify(req.body).length;
  }

  // Extract user ID from JWT or session
  if ((req as any).user) {
    req.userId = (req as any).user.id || (req as any).user.userId;
  }

  // Extract API key from header
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (apiKey && typeof apiKey === 'string') {
    req.apiKey = apiKey;
  }

  // Override res.end to track response
  const originalEnd = res.end;
  let responseSize = 0;

  res.end = function(chunk?: any, encoding?: any) {
    // Calculate response size
    if (chunk) {
      if (Buffer.isBuffer(chunk)) {
        responseSize = chunk.length;
      } else if (typeof chunk === 'string') {
        responseSize = Buffer.byteLength(chunk, encoding || 'utf8');
      }
    }

    // Track the usage
    const responseTime = Date.now() - (req.startTime || 0);
    
    // Simply track usage with endpoint - don't use non-existent trackRequest method
    usageTracker.trackUsage(req.route?.path || req.path).catch(err => {
      logger.error('Failed to track usage:', err);
    });

    // Call original end
    originalEnd.call(this, chunk, encoding);
  } as any;

  next();
}

/**
 * Middleware to check rate limits
 */
export function checkRateLimit(req: RequestWithUsage, res: Response, next: NextFunction) {
  // Rate limiting is disabled for now
  next();
}

/**
 * Create a custom rate limiter for specific endpoints
 */
export function createEndpointRateLimiter(
  endpoint: string,
  limit: number,
  windowMs: number = 60 * 60 * 1000 // 1 hour default
) {
  return async (req: RequestWithUsage, res: Response, next: NextFunction) => {
    // Rate limiting is disabled for now
    next();
  };
}