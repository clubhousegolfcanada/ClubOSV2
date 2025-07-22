import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import compression from 'compression';
import morgan from 'morgan';
import { Express, Request, Response, NextFunction } from 'express';
import { logger, stream } from '../utils/logger';
import { config } from '../utils/envValidator';

// Custom CSRF token middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for public endpoints
  const publicPaths = ['/health', '/api/slack/webhook'];
  if (publicPaths.includes(req.path)) {
    return next();
  }

  // Skip CSRF check for GET requests
  if (req.method === 'GET') {
    return next();
  }

  // Check for CSRF token in headers
  const token = req.headers['x-csrf-token'];
  const sessionToken = req.headers['x-session-token'];

  // In production, implement proper CSRF validation
  if (config.NODE_ENV === 'production' && !token) {
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'Security validation failed'
    });
  }

  // Skip CSRF in development/demo mode for now
  if (config.NODE_ENV === 'development') {
    return next();
  }

  next();
};

// Rate limiting configurations
export const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      res.status(429).json({
        error: 'Too Many Requests',
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Different rate limiters for different endpoints
export const generalLimiter = createRateLimiter(
  parseInt(config.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  parseInt(config.RATE_LIMIT_MAX || '100'),
  'Too many requests, please try again later'
);

export const strictLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  config.NODE_ENV === 'development' ? 100 : 5, // 100 requests per minute in dev, 5 in production
  'Too many requests to this endpoint, please try again later'
);

export const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts per 15 minutes
  'Too many authentication attempts, please try again later'
);

// Security headers configuration
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com", "https://hooks.slack.com"],
    },
  },
  crossOriginEmbedderPolicy: config.NODE_ENV === 'production',
});

// Request sanitization
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize params
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// Helper function to sanitize objects
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        // Remove potential XSS attempts
        sanitized[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

// API key validation middleware
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  // Skip API key check for public endpoints
  const publicPaths = ['/health', '/api/slack/webhook'];
  if (publicPaths.includes(req.path)) {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  
  // In production, validate against stored API keys
  if (config.NODE_ENV === 'production' && !apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required'
    });
  }

  next();
};

// Apply all security middleware
export const applySecurityMiddleware = (app: Express) => {
  // Basic security headers
  app.use(securityHeaders);
  
  // Compression
  app.use(compression());
  
  // HTTP request logging
  app.use(morgan('combined', { stream }));
  
  // Prevent NoSQL injection attacks
  app.use(mongoSanitize());
  
  // Prevent HTTP Parameter Pollution
  app.use(hpp());
  
  // Request sanitization
  app.use(sanitizeRequest);
  
  // Rate limiting - apply to all routes
  // DISABLED FOR DEVELOPMENT
  // app.use('/api/', generalLimiter);
  
  // Strict rate limiting for sensitive endpoints
  // app.use('/api/llm/', strictLimiter);
  // app.use('/api/auth/', authLimiter);
  
  // CSRF protection
  app.use(csrfProtection);
  
  // API key validation (if needed)
  // app.use(validateApiKey);
  
  // Security event logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Log security-relevant events
    if (req.method !== 'GET' && req.method !== 'OPTIONS') {
      logger.info('Security audit', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      });
    }
    next();
  });
};

// Content-Type validation middleware
export const validateContentType = (expectedType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const contentType = req.headers['content-type'];
      if (!contentType || !contentType.includes(expectedType)) {
        return res.status(415).json({
          error: 'Unsupported Media Type',
          message: `Content-Type must be ${expectedType}`
        });
      }
    }
    next();
  };
};

// File upload security
export const fileUploadSecurity = (req: Request, res: Response, next: NextFunction) => {
  // Implement file upload restrictions
  const maxFileSize = 5 * 1024 * 1024; // 5MB
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  
  if (req.files) {
    // Validate file uploads
    const files = Array.isArray(req.files) ? req.files : [req.files];
    
    for (const file of files) {
      // Check file size
      if (file.size > maxFileSize) {
        return res.status(413).json({
          error: 'File too large',
          message: 'File size must be less than 5MB'
        });
      }
      
      // Check mime type
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(415).json({
          error: 'Invalid file type',
          message: 'Only JPEG, PNG, GIF, and PDF files are allowed'
        });
      }
    }
  }
  
  next();
};
