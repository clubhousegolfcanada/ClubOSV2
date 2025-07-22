import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { appendToJsonArray } from '../utils/fileUtils';

interface RequestLog {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  query: any;
  body: any;
  headers: any;
  ip: string;
  userAgent?: string;
  duration?: number;
  statusCode?: number;
}

export const requestLogger = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  // Attach request ID to request object
  (req as any).requestId = requestId;
  
  const requestLog: RequestLog = {
    id: requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      'x-forwarded-for': req.headers['x-forwarded-for']
    },
    ip: req.ip || req.socket.remoteAddress || '',
    userAgent: req.headers['user-agent']
  };

  // Log request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path
  });

  // Override res.end to capture response details
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const duration = Date.now() - startTime;
    
    requestLog.duration = duration;
    requestLog.statusCode = res.statusCode;
    
    // Log response
    logger.info('Request completed', {
      requestId,
      duration,
      statusCode: res.statusCode
    });
    
    // Save to request logs asynchronously
    appendToJsonArray('logs/requests.json', requestLog).catch(err => {
      logger.error('Failed to save request log:', err);
    });
    
    originalEnd.apply(res, args);
  };

  next();
};
