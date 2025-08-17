import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

interface CustomerRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

/**
 * Rate limiter for customer authentication endpoints
 */
export const customerAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use IP address for rate limiting
    return req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many authentication attempts',
      retryAfter: req.rateLimit?.resetTime
    });
  }
});

/**
 * General rate limiter for customer API endpoints
 */
export const customerApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many requests, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: CustomerRequest) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.userId || req.ip || 'unknown';
  },
  skip: (req: CustomerRequest) => {
    // Skip rate limiting for premium users (future feature)
    return req.user?.email?.includes('@vip') || false;
  }
});

/**
 * Strict rate limiter for sensitive operations
 */
export const customerStrictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: 'Rate limit exceeded for this operation',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: CustomerRequest) => {
    return req.user?.userId || req.ip || 'unknown';
  }
});

/**
 * Rate limiter for social features (friend requests, etc.)
 */
export const socialActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 social actions per hour
  message: 'Too many social actions, please wait before trying again',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: CustomerRequest) => {
    return req.user?.userId || req.ip || 'unknown';
  }
});

/**
 * Rate limiter for booking operations
 */
export const bookingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 booking operations per 5 minutes
  message: 'Too many booking requests, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: CustomerRequest) => {
    return req.user?.userId || req.ip || 'unknown';
  }
});

/**
 * Rate limiter for event operations
 */
export const eventLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 15, // 15 event operations per 10 minutes
  message: 'Too many event requests, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: CustomerRequest) => {
    return req.user?.userId || req.ip || 'unknown';
  }
});

export default {
  customerAuthLimiter,
  customerApiLimiter,
  customerStrictLimiter,
  socialActionLimiter,
  bookingLimiter,
  eventLimiter
};