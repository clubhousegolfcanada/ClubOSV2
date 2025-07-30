import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

// Create a stricter rate limiter for public endpoints
export const publicRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 10, // 10 requests per minute per IP
  message: 'Too many requests from this IP. Please try again in a minute or text us at (902) 707-3748.',
  standardHeaders: true,
  legacyHeaders: false,
  
  // Custom handler for when limit is exceeded
  handler: (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    logger.warn('Public rate limit exceeded', {
      ip,
      path: req.path,
      headers: req.headers
    });
    
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please wait a moment or text us directly at (902) 707-3748 for immediate help.',
      retryAfter: 60
    });
  },
  
  // Skip successful requests from being counted
  skipSuccessfulRequests: false,
  
  // Use IP address for rate limiting
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
});

// Even stricter limiter for potential abuse (1 request per 10 seconds)
export const publicAbuseLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 1, // 1 request per 10 seconds
  skipSuccessfulRequests: true, // Only count failed requests
  
  handler: (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    logger.error('Potential abuse detected from public endpoint', {
      ip,
      path: req.path,
      userAgent: req.headers['user-agent']
    });
    
    res.status(429).json({
      success: false,
      message: 'Please slow down. Contact us at (902) 707-3748 for help.',
      blocked: true
    });
  }
});