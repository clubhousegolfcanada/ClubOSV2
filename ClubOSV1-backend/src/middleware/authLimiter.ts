import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';
import { Request } from 'express';

// Custom key generator for Railway deployment
const keyGenerator = (req: Request): string => {
  // Use X-Forwarded-For header if available (Railway proxy)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // Take the first IP from the comma-separated list
    const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
    return ips[0].trim();
  }
  // Fallback to req.ip
  return req.ip || 'unknown';
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Increased for testing (was 5)
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator,
  validate: false, // Disable trust proxy validation for Railway
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
