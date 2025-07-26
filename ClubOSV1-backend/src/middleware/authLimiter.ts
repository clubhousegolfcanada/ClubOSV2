import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  // Trust proxy is required for Railway, but we need to be specific
  trustProxy: process.env.NODE_ENV === 'production' ? 1 : false,
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', { 
      ip: req.ip,
      path: req.path 
    });
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later.'
    });
  }
});
