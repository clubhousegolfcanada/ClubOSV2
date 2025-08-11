import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';
import * as Sentry from '@sentry/node';
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

// Different rate limits for different endpoints
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 1000 : 500, // Temporarily increased to prevent lockouts
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  validate: false, // Disable trust proxy validation for Railway
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.path === '/health') return true;
    // Skip for authenticated admin users
    if (req.user?.role === 'admin') return true;
    // Skip in development unless explicitly testing
    if (process.env.NODE_ENV === 'development' && process.env.TEST_RATE_LIMIT !== 'true') return true;
    return false;
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { 
      ip: req.ip,
      path: req.path,
      userAgent: req.get('user-agent')
    });
    
    // Track in Sentry as a warning
    Sentry.captureMessage('Rate limit exceeded', {
      level: 'warning',
      extra: {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('user-agent')
      }
    });
    
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
      retryAfter: req.rateLimit?.resetTime
    });
  }
});

// Stricter rate limit for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 login attempts per 15 minutes
  skipSuccessfulRequests: true, // Don't count successful logins
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  validate: false, // Disable trust proxy validation for Railway
  handler: (req, res) => {
    logger.error('Auth rate limit exceeded', { 
      ip: req.ip,
      email: req.body?.email
    });
    
    // Track in Sentry as an error
    Sentry.captureMessage('Authentication rate limit exceeded', {
      level: 'error',
      extra: {
        ip: req.ip,
        email: req.body?.email
      }
    });
    
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again in 15 minutes.',
      retryAfter: req.rateLimit?.resetTime
    });
  }
});

// API-specific rate limiter for LLM endpoints (more expensive)
export const llmRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Increased for testing (was 10)
  message: 'Too many AI requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  validate: false, // Disable trust proxy validation for Railway
  skip: (req) => {
    // Skip for operators and admins
    if (req.user?.role === 'admin' || req.user?.role === 'operator') return true;
    return false;
  }
});

// Rate limiter for sending messages
export const messageSendLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute per user
  message: 'Too many messages sent, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    if (req.user?.id) {
      return `user_${req.user.id}`;
    }
    return keyGenerator(req);
  },
  validate: false,
  skip: (req) => {
    // Skip for admin users
    if (req.user?.role === 'admin') return true;
    return false;
  },
  handler: (req, res) => {
    logger.warn('Message send rate limit exceeded', { 
      userId: req.user?.id,
      ip: req.ip
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many messages sent. Please wait a moment before sending more.',
      retryAfter: req.rateLimit?.resetTime
    });
  }
});