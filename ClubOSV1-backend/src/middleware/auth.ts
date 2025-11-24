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

// Generate JWT token with role-based expiration - ENHANCED FOR PWA EXPERIENCE
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>, rememberMe: boolean = false): string => {
  // Role-based token expiration times - Operator-friendly durations
  let expiresIn: string;

  if (rememberMe) {
    // With "Remember Me" - Extended durations for PWA experience
    switch (payload.role) {
      case 'operator':
      case 'admin':
        expiresIn = '30d';  // Operators/admins get month-long tokens
        break;
      case 'customer':
        expiresIn = '90d';  // Customers get 3 months
        break;
      case 'contractor':
        expiresIn = '7d';   // Contractors get weekly tokens
        break;
      case 'kiosk':
        expiresIn = '30d';  // Kiosks stay logged in for a month
        break;
      default:
        expiresIn = '7d';   // Default to a week
    }
  } else {
    // Without "Remember Me" - Still generous for operators
    switch (payload.role) {
      case 'operator':
      case 'admin':
        expiresIn = '7d';   // Full week for operators even without Remember Me
        break;
      case 'customer':
        expiresIn = '24h';  // 24 hours for customers
        break;
      case 'kiosk':
        expiresIn = '7d';   // Kiosks get a week
        break;
      case 'contractor':
        expiresIn = '8h';   // 8 hours for contractors (shift-based)
        break;
      default:
        expiresIn = '24h';  // Default to 24 hours
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
    // Log the auth header for debugging (DEBUG level to reduce log volume)
    logger.debug('Auth middleware called:', {
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

    // OPTIMIZATION: Check if token is blacklisted BEFORE expensive JWT verification
    // This saves CPU cycles on known-bad tokens
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const blacklistCheck = await db.query(
        'SELECT id FROM blacklisted_tokens WHERE token_hash = $1',
        [tokenHash]
      );

      if (blacklistCheck.rows.length > 0) {
        logger.warn('Blacklisted token used (blocked before JWT verification)', {
          tokenHash: tokenHash.substring(0, 8) + '...',
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

    // Now verify token (only if not blacklisted)
    const decoded = verifyToken(token);
    
    /**
     * TOKEN REFRESH STRATEGY
     *
     * This sophisticated token refresh logic replaces the old frontend grace period approach.
     * Instead of allowing expired tokens for 5 minutes after login (which was a security risk),
     * we now proactively refresh tokens BEFORE they expire based on role-specific thresholds.
     *
     * Refresh Thresholds by Role:
     * - Operators/Admins: Refresh at 70% of token lifetime (most aggressive)
     * - Customers: Refresh at 50% of token lifetime (moderate)
     * - Others: Refresh at 80% of token lifetime (conservative)
     * - All roles: Force refresh when less than 2 days remain
     *
     * This ensures tokens never expire during active use, eliminating the need for
     * grace periods or complex frontend workarounds. The backend handles everything
     * transparently via the X-New-Token response header.
     */
    const now = Date.now() / 1000;
    const timeUntilExpiry = (decoded.exp || 0) - now;
    const totalTokenLife = (decoded.exp || 0) - (decoded.iat || 0);
    const tokenAgePercent = ((totalTokenLife - timeUntilExpiry) / totalTokenLife) * 100;

    let shouldRefresh = false;

    if (decoded.role === 'operator' || decoded.role === 'admin') {
      // Operators/admins: Refresh when 70% of lifetime is consumed
      shouldRefresh = tokenAgePercent > 70;
    } else if (decoded.role === 'customer') {
      // Customers: Refresh when 50% of lifetime is consumed
      shouldRefresh = tokenAgePercent > 50;
    } else {
      // Others: Refresh when 80% consumed or less than 1 hour remains
      shouldRefresh = tokenAgePercent > 80 || timeUntilExpiry < 3600;
    }

    // Also force refresh if less than 2 days remain for any role
    if (timeUntilExpiry < (2 * 24 * 3600)) {
      shouldRefresh = true;
    }

    if (shouldRefresh) {
      // Token needs refresh, send a new one in response header
      // Check if original token was long-lived (remember me)
      const wasRememberMe = totalTokenLife > 604800; // More than 7 days means remember me was used

      const newToken = generateToken({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        sessionId: decoded.sessionId,
        name: decoded.name,
        phone: decoded.phone
      }, wasRememberMe);

      res.setHeader('X-New-Token', newToken);

      // Log token refresh for monitoring (DEBUG level to reduce log volume)
      logger.debug('Token auto-refreshed for PWA persistence', {
        userId: decoded.userId,
        role: decoded.role,
        tokenAgePercent: Math.round(tokenAgePercent),
        daysRemaining: Math.round(timeUntilExpiry / 86400),
        newTokenLife: wasRememberMe ? '30-90d' : '7-24h'
      });
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

    // Log authentication (DEBUG level to reduce log volume - successful auth is normal)
    logger.debug('User authenticated', {
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

  // Log API key usage (DEBUG level to reduce log volume)
  logger.debug('API key authenticated', {
    apiKey: apiKey.substring(0, 8) + '...',
    path: req.path,
    method: req.method
  });

  next();
};

// Alias for authorize to match common naming conventions
export const requireRole = authorize;
