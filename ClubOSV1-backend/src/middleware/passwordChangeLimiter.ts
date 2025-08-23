import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';
import { Request } from 'express';

// Custom key generator for authenticated users
const keyGenerator = (req: Request): string => {
  // Use user ID if authenticated
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  
  // Fallback to IP-based limiting
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
    return `ip:${ips[0].trim()}`;
  }
  
  return `ip:${req.ip || 'unknown'}`;
};

export const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Maximum 3 password change attempts per 15 minutes
  message: 'Too many password change attempts. Please wait 15 minutes before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful password changes
  keyGenerator,
  validate: false,
  handler: (req, res) => {
    logger.warn('Password change rate limit exceeded', { 
      userId: req.user?.id,
      ip: req.ip,
      path: req.path 
    });
    res.status(429).json({
      success: false,
      message: 'Too many password change attempts. Please wait 15 minutes before trying again.'
    });
  }
});