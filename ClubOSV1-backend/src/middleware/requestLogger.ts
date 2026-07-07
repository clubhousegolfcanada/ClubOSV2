import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

// Query params that must never reach the logs. The messages page passes the JWT
// as ?token= for SSE (EventSource can't set an Authorization header), and this
// logger records req.query on every request — so an un-redacted log leaks every
// operator's bearer token into Railway's log stream.
const SENSITIVE_QUERY_KEYS = new Set([
  'token', 'access_token', 'refresh_token', 'api_key', 'apikey',
  'secret', 'password', 'auth', 'jwt', 'sig', 'signature'
]);

function redactQuery(query: Request['query']): Record<string, unknown> {
  if (!query || typeof query !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(query)) {
    out[k] = SENSITIVE_QUERY_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : (query as any)[k];
  }
  return out;
}

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
      query: redactQuery(req.query),
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
