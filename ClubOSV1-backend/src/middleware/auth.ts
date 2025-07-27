import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../utils/envValidator';
import { logger } from '../utils/logger';
import { UserRole, JWTPayload as IJWTPayload } from '../types';

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

// Generate JWT token
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'clubosv1',
    audience: 'clubosv1-users'
  });
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
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    
    // Check if token is about to expire (less than 1 hour)
    const now = Date.now() / 1000;
    const timeUntilExpiry = (decoded.exp || 0) - now;
    
    if (timeUntilExpiry < 3600) {
      // Token will expire soon, send a new one in response header
      const newToken = generateToken({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        sessionId: decoded.sessionId,
        name: decoded.name,
        phone: decoded.phone
      });
      res.setHeader('X-New-Token', newToken);
    }

    // Validate role exists
    if (!decoded.role || !['admin', 'operator', 'support', 'kiosk'].includes(decoded.role)) {
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
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired'
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid token attempt', {
        error: error.message,
        ip: req.ip
      });
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    }

    logger.error('Authentication error', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
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

  // In a real application, check if session is still valid in database/cache
  const sessionValid = true; // Placeholder

  if (!sessionValid) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Session expired'
    });
  }

  next();
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
