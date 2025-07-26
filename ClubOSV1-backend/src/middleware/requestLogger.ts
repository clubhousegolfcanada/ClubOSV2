import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const originalSend = res.send;
  const originalJson = res.json;
  let responseBody: any;

  // Capture response body
  res.send = function(data: any): Response {
    responseBody = data;
    res.send = originalSend;
    return originalSend.call(this, data);
  };

  res.json = function(data: any): Response {
    responseBody = data;
    res.json = originalJson;
    return originalJson.call(this, data);
  };

  // Log when response finishes
  res.on('finish', async () => {
    const duration = Date.now() - start;
    const user = (req as any).user;
    
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      path: req.path,
      query: req.query,
      statusCode: res.statusCode,
      duration,
      userId: user?.id,
      userEmail: user?.email,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Log to database asynchronously
    if (req.path !== '/health' && !req.path.startsWith('/api/access')) {
      db.logRequest({
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
        response_time: duration,
        user_id: user?.id,
        ip_address: req.ip || 'unknown',
        user_agent: req.get('user-agent') || 'unknown',
        error: res.statusCode >= 400 ? responseBody?.message || 'Error' : null
      }).catch(err => {
        logger.error('Failed to log request to database:', err);
      });
    }
  });

  next();
};
