import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../utils/logger';

/**
 * Wrapper for async route handlers to ensure errors are caught
 * and CORS headers are always sent
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logger.error('Async handler error:', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method
      });

      // Always send a response with CORS headers set
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error.message || 'An unexpected error occurred',
            timestamp: new Date().toISOString()
          }
        });
      }
    });
  };
};