import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased from 100 to 500 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in development, be more lenient in production
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.path === '/health') return true;
    // Skip for authenticated admin users
    if (req.user?.role === 'admin') return true;
    return false;
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { 
      ip: req.ip,
      path: req.path 
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.'
    });
  }
});
