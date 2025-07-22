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
    
    usageTracker.trackRequest({
      userId: req.userId,
      apiKey: req.apiKey,
      endpoint: req.route?.path || req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      requestSize: req.requestSize || 0,
      responseSize,
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'],
      error: res.statusCode >= 400 ? res.statusMessage : undefined,
      metadata: {
        query: req.query,
        params: req.params
      }
    }).catch(error => {
      logger.error('Failed to track usage:', error);
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
  // Extract user ID and API key
  const userId = (req as any).user?.id || (req as any).user?.userId;
  const apiKey = req.headers['x-api-key'] || 
                 req.headers['authorization']?.replace('Bearer ', '');

  usageTracker.checkRateLimit(
    userId,
    typeof apiKey === 'string' ? apiKey : undefined,
    req.path
  ).then(result => {
    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetAt.toISOString()
    });

    if (!result.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests',
        limit: result.limit,
        resetAt: result.resetAt
      });
    }

    next();
  }).catch(error => {
    logger.error('Failed to check rate limit:', error);
    // Allow request on error
    next();
  });
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
    const userId = (req as any).user?.id;
    const apiKey = req.headers['x-api-key'] as string;
    
    const result = await usageTracker.checkRateLimit(userId, apiKey, endpoint);
    
    if (!result.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests to ${endpoint}`,
        limit: result.limit,
        resetAt: result.resetAt
      });
    }
    
    next();
  };
}
