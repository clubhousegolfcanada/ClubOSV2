import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../utils/envValidator';
import { logger } from '../utils/logger';
import { UserRole, JWTPayload as IJWTPayload } from '../types';
import { db } from '../utils/database';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string;
        phone?: string;
        role: UserRole;
        sessionId: string;
      };
    }
  }
}

// Extended JWT payload for internal use
interface JWTPayload extends IJWTPayload {
  sessionId: string;
  name?: string;
  phone?: string;
}

// Generate JWT token with role-based expiration
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>, rememberMe: boolean = false): string => {
  // Role-based token expiration times
  let expiresIn: string;
  
  if (rememberMe) {
    // With "Remember Me" - 30 days for all roles
    expiresIn = '30d';
  } else {
    // Without "Remember Me" - role-based shorter sessions
    switch (payload.role) {
      case 'customer':
        expiresIn = '8h';  // 8 hours for customers
        break;
      case 'operator':
      case 'admin':
        expiresIn = '4h';  // 4 hours for operators and admins
        break;
      case 'kiosk':
        expiresIn = '12h'; // 12 hours for kiosk mode
        break;
      case 'contractor':
        expiresIn = '8h';  // 8 hours for contractors
        break;
      default:
        expiresIn = '4h';  // Default to 4 hours for safety
    }
  }
  
  return jwt.sign(payload, config.JWT_SECRET as string, {
    expiresIn: expiresIn,
    issuer: 'clubosv1',
    audience: 'clubosv1-users'
  } as jwt.SignOptions);
};

// Verify JWT token
export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, config.JWT_SECRET, {
    issuer: 'clubosv1',
    audience: 'clubosv1-users'
  }) as JWTPayload;
};

// Authentication middleware
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  // Wrap in async function to handle await properly
  (async () => {
    const authHeader = req.headers.authorization;
    
    try {
    // Log the auth header for debugging
    logger.info('Auth middleware called:', {
      path: req.path,
      method: req.method,
      hasAuthHeader: !!authHeader,
      authHeaderLength: authHeader?.length,
      authHeaderPreview: authHeader ? authHeader.substring(0, 20) + '...' : 'none'
    });
    
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      logger.warn('No token provided', {
        path: req.path,
        method: req.method,
        headers: Object.keys(req.headers)
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    
    // Check if token is blacklisted (only if table exists)
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const blacklistCheck = await db.query(
        'SELECT id FROM blacklisted_tokens WHERE token_hash = $1',
        [tokenHash]
      );
      
      if (blacklistCheck.rows.length > 0) {
        logger.warn('Blacklisted token used', {
          userId: decoded.userId,
          path: req.path
        });
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Token has been revoked'
        });
      }
    } catch (blacklistError: any) {
      // If blacklist table doesn't exist yet, log but continue
      // This allows the system to work before migration runs
      if (blacklistError.code === '42P01') {
        logger.debug('Blacklist table not yet created, skipping check');
      } else {
        logger.error('Error checking token blacklist', { error: blacklistError });
      }
    }
    
    // Check if token is about to expire (less than 1 hour)
    const now = Date.now() / 1000;
    const timeUntilExpiry = (decoded.exp || 0) - now;
    
    if (timeUntilExpiry < 3600) {
      // Token will expire soon, send a new one in response header
      // Check if original token was long-lived (remember me)
      const totalTokenLife = (decoded.exp || 0) - (decoded.iat || 0);
      const wasRememberMe = totalTokenLife > 86400; // More than 24 hours means it was remember me
      
      const newToken = generateToken({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        sessionId: decoded.sessionId,
        name: decoded.name,
        phone: decoded.phone
      }, wasRememberMe);
      res.setHeader('X-New-Token', newToken);
    }

    // Validate role exists - include customer and contractor roles
    if (!decoded.role || !['admin', 'operator', 'support', 'kiosk', 'customer', 'contractor'].includes(decoded.role)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token: missing or invalid role'
      });
    }

    // Attach user to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      phone: decoded.phone,
      role: decoded.role as UserRole,
      sessionId: decoded.sessionId
    };

    // Log authentication
    logger.info('User authenticated', {
      userId: decoded.userId,
      role: decoded.role,
      path: req.path,
      method: req.method
    });

    next();
  } catch (error: any) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired'
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid token attempt', {
        error: error.message,
        ip: req.ip,
        path: req.path,
        tokenLength: authHeader?.length
      });
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    logger.error('Authentication error', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
  })().catch(err => {
    // Handle any uncaught async errors
    logger.error('Authentication middleware error', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  });
};

// Role-based authorization middleware
export const authorize = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Unauthorized access attempt', {
        userId: req.user.id,
        role: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Optional authentication - doesn't fail if no token
export const optionalAuthenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (token) {
      const decoded = verifyToken(token);
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role as UserRole,
        sessionId: decoded.sessionId
      };
    }
  } catch (error) {
    // Ignore errors for optional auth
  }

  next();
};

// Password utilities
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// Session validation
export const validateSession = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next();
  }

  try {
    // Check if user still exists and is active
    const user = await db.findUserById(req.user.id);
    
    if (!user) {
      logger.warn('Session validation failed: User not found', { userId: req.user.id });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Session invalid'
      });
    }
    
    // Check if user is deactivated (if we add this field in future)
    // if (user.isDeactivated) {
    //   return res.status(401).json({
    //     error: 'Unauthorized',
    //     message: 'Account deactivated'
    //   });
    // }
    
    // Additional session checks can be added here:
    // - Check session ID in Redis/cache
    // - Check last activity timestamp
    // - Check IP address changes
    // - Check device fingerprint
    
    next();
  } catch (error) {
    logger.error('Session validation error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Session validation failed'
    });
  }
};

// API Key authentication (alternative to JWT)
export const authenticateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required'
    });
  }

  // In production, validate against stored API keys
  // For now, we'll use a simple check
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    logger.warn('Invalid API key attempt', {
      apiKey: apiKey.substring(0, 8) + '...',
      ip: req.ip
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  // Log API key usage
  logger.info('API key authenticated', {
    apiKey: apiKey.substring(0, 8) + '...',
    path: req.path,
    method: req.method
  });

  next();
};
