import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { Request, Response } from 'express';
import logger from '../utils/logger';

// Create Redis client for rate limiting
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 2, // Use a different DB for rate limiting
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

redisClient.on('error', (error) => {
  logger.error('Redis rate limiter error:', error);
});

// Challenge creation rate limiter
export const challengeCreationLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:challenge:create:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 10, // Max 10 challenges per hour
  message: 'Too many challenges created. Please wait before creating another.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Rate limit by user ID
    return req.user?.id || req.ip;
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Challenge creation rate limit exceeded for user ${req.user?.id}`);
    res.status(429).json({
      success: false,
      error: 'Too many challenges created. You can create up to 10 challenges per hour.',
      retryAfter: req.rateLimit?.resetTime
    });
  }
});

// Challenge acceptance rate limiter
export const challengeAcceptanceLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:challenge:accept:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minute window
  max: 20, // Max 20 acceptances per 15 minutes
  message: 'Too many challenge acceptances. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.user?.id || req.ip;
  }
});

// Challenge API general rate limiter
export const challengeApiLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:challenge:api:'
  }),
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 100, // Max 100 requests per minute
  message: 'Too many requests to challenge API.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.user?.id || req.ip;
  }
});

// Large wager limiter (additional check for high-value challenges)
export const largeWagerLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:challenge:highvalue:'
  }),
  windowMs: 24 * 60 * 60 * 1000, // 24 hour window
  max: 5, // Max 5 high-value challenges per day
  message: 'Too many high-value challenges. Please wait 24 hours.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Only apply to challenges over 1000 CC
    const wagerAmount = req.body?.wagerAmount || 0;
    return wagerAmount <= 1000;
  },
  keyGenerator: (req: Request) => {
    return req.user?.id || req.ip;
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`High-value challenge rate limit exceeded for user ${req.user?.id}`);
    res.status(429).json({
      success: false,
      error: 'Too many high-value challenges. You can create up to 5 challenges over 1000 CC per day.',
      retryAfter: req.rateLimit?.resetTime
    });
  }
});

// Anti-spam middleware for challenge messages
export const challengeMessageSpamFilter = (req: Request, res: Response, next: Function) => {
  const message = req.body?.creatorNote || req.body?.message || '';
  
  // Check for spam patterns
  const spamPatterns = [
    /(.)\1{10,}/gi, // Repeated characters
    /(https?:\/\/[^\s]+){3,}/gi, // Multiple URLs
    /\b(click here|free money|guaranteed win)\b/gi, // Spam phrases
    /[A-Z\s]{20,}/g // All caps spam
  ];
  
  for (const pattern of spamPatterns) {
    if (pattern.test(message)) {
      logger.warn(`Spam detected in challenge message from user ${req.user?.id}`);
      return res.status(400).json({
        success: false,
        error: 'Your message appears to contain spam. Please revise and try again.'
      });
    }
  }
  
  next();
};

// Credibility-based rate limiting
export const credibilityBasedLimiter = async (req: Request, res: Response, next: Function) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next();
    
    // Get user's credibility score
    const pool = await import('../config/database');
    const result = await pool.default.query(
      'SELECT credibility_score FROM customer_profiles WHERE user_id = $1',
      [userId]
    );
    
    const credibilityScore = result.rows[0]?.credibility_score || 100;
    
    // Apply stricter limits for low credibility users
    if (credibilityScore < 50) {
      // Check recent challenge creation
      const recentChallenges = await pool.default.query(
        `SELECT COUNT(*) as count 
         FROM challenges 
         WHERE creator_id = $1 
         AND created_at > NOW() - INTERVAL '24 hours'`,
        [userId]
      );
      
      if (parseInt(recentChallenges.rows[0].count) >= 3) {
        logger.warn(`Low credibility user ${userId} exceeded challenge limit`);
        return res.status(429).json({
          success: false,
          error: 'Your account has limited challenge creation due to low credibility score.',
          credibilityScore
        });
      }
    }
    
    next();
  } catch (error) {
    logger.error('Error in credibility-based limiter:', error);
    next(); // Continue on error
  }
};

// Export combined middleware
export const challengeRateLimiters = [
  challengeApiLimiter,
  challengeMessageSpamFilter,
  credibilityBasedLimiter
];

export const challengeCreationRateLimiters = [
  ...challengeRateLimiters,
  challengeCreationLimiter,
  largeWagerLimiter
];

export const challengeAcceptanceRateLimiters = [
  ...challengeRateLimiters,
  challengeAcceptanceLimiter
];