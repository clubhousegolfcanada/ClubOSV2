import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import compression from 'compression';
import morgan from 'morgan';
import { Express, Request, Response, NextFunction } from 'express';
import { logger, stream } from '../utils/logger';
import { config } from '../utils/envValidator';
import { generateCSRFToken, validateCSRFToken, getSessionId, addCSRFToken } from '../utils/csrf';

// Custom CSRF token middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for public endpoints
  const publicPaths = ['/health', '/api/slack/webhook', '/api/public/', '/api/auth/login', '/api/auth/register', '/api/csrf-token'];
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Skip CSRF check for GET and OPTIONS requests
  if (req.method === 'GET' || req.method === 'OPTIONS') {
    // Add CSRF token to response for GET requests
    if (req.method === 'GET') {
      addCSRFToken(req, res);
    }
    return next();
  }

  // Get CSRF token from headers or cookies
  const headerToken = req.headers['x-csrf-token'] as string;
  const cookieToken = req.cookies?.['csrf-token'];
  const token = headerToken || cookieToken;

  // Check if token exists
  if (!token) {
    logger.warn('CSRF token missing', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'Security validation failed. Please refresh the page and try again.'
    });
  }

  // Validate CSRF token
  const sessionId = getSessionId(req);
  if (!validateCSRFToken(sessionId, token)) {
    logger.warn('Invalid CSRF token', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'Security validation failed. Please refresh the page and try again.'
    });
  }

  // Token is valid, continue
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
    // Skip problematic headers
    skip: (req) => {
      // Skip rate limiting in development
      if (config.NODE_ENV === 'development') return true;
      return false;
    },
    keyGenerator: (req) => {
      // Use the rightmost IP in X-Forwarded-For or fall back to req.ip
      const forwarded = req.headers['x-forwarded-for'] as string;
      if (forwarded) {
        const ips = forwarded.split(',').map(ip => ip.trim());
        return ips[ips.length - 1]; // Use the rightmost IP
      }
      return req.ip || 'unknown';
    },
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

// Public rate limiter for customer-facing endpoints
export const publicLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  20, // 20 requests per minute
  'Please wait a moment before asking another question'
);

// Security headers configuration
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for React
        "'unsafe-eval'", // Required for some bundlers in dev
        "https://cdn.jsdelivr.net", // For any CDN scripts
        "https://vercel.live" // Vercel analytics
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline styles
        "https://fonts.googleapis.com"
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'",
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
        "https://api.openai.com",
        "https://api.stripe.com",
        "https://api.openphone.com",
        "wss:", // WebSocket connections
        "https:" // General HTTPS APIs
      ],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      childSrc: ["'self'"],
      frameSrc: ["'self'", "https://js.stripe.com"], // Stripe checkout
      workerSrc: ["'self'", "blob:"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false, // Still disabled for CORS compatibility
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
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
  if (config.NODE_ENV === 'production') {
    app.use('/api/', generalLimiter);
    
    // Strict rate limiting for sensitive endpoints
    app.use('/api/llm/', strictLimiter);
    app.use('/api/auth/', authLimiter);
    app.use('/api/public/', publicLimiter);
    
    logger.info('Rate limiting enabled for production environment');
  } else {
    logger.info('Rate limiting disabled for development environment');
  }
  
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
  
  // Type assertion for files property (added by multer or similar middleware)
  const reqWithFiles = req as Request & { files?: any };
  
  if (reqWithFiles.files) {
    // Validate file uploads
    const files = Array.isArray(reqWithFiles.files) ? reqWithFiles.files : [reqWithFiles.files];
    
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
