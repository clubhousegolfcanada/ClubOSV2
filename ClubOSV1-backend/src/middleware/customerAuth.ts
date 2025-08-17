import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../utils/db';

interface CustomerTokenPayload {
  id: string;
  email: string;
  role: 'customer';
  isCustomer: boolean;
  deviceId?: string;
  sessionId: string;
}

interface CustomerRequest extends Request {
  user?: CustomerTokenPayload;
  deviceId?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRY = '15m'; // Access token expires in 15 minutes
const REFRESH_TOKEN_EXPIRY = '30d'; // Refresh token expires in 30 days

/**
 * Generate access and refresh tokens for customer
 */
export const generateCustomerTokens = async (
  userId: string,
  email: string,
  deviceId?: string
) => {
  const payload: CustomerTokenPayload = {
    id: userId,
    email,
    role: 'customer',
    isCustomer: true,
    deviceId,
    sessionId: `customer_${userId}_${Date.now()}`
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  
  const refreshPayload = { ...payload, type: 'refresh' };
  const refreshToken = jwt.sign(refreshPayload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

  // Store refresh token in database
  try {
    await pool.query(
      `INSERT INTO customer_auth_tokens 
       (user_id, refresh_token, device_id, device_type, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')
       ON CONFLICT (refresh_token) 
       DO UPDATE SET last_used = CURRENT_TIMESTAMP`,
      [userId, refreshToken, deviceId, deviceId ? 'mobile' : 'web']
    );
  } catch (error) {
    console.error('Error storing refresh token:', error);
  }

  return { accessToken, refreshToken };
};

/**
 * Middleware to authenticate customer requests
 */
export const authenticateCustomer = async (
  req: CustomerRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as CustomerTokenPayload;
      
      // Verify user is a customer
      if (!decoded.isCustomer) {
        return res.status(403).json({ error: 'Not a customer account' });
      }

      // Verify user exists and is active
      const userResult = await pool.query(
        'SELECT id, email, is_active FROM users WHERE id = $1 AND is_customer = true',
        [decoded.id]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (!userResult.rows[0].is_active) {
        return res.status(403).json({ error: 'Account is disabled' });
      }

      req.user = decoded;
      req.deviceId = decoded.deviceId;
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Refresh access token using refresh token
 */
export const refreshCustomerToken = async (
  req: Request,
  res: Response
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as CustomerTokenPayload & { type: string };
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if refresh token exists in database and is not expired
    const tokenResult = await pool.query(
      `SELECT * FROM customer_auth_tokens 
       WHERE refresh_token = $1 
       AND user_id = $2 
       AND expires_at > CURRENT_TIMESTAMP`,
      [refreshToken, decoded.id]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ error: 'Refresh token not found or expired' });
    }

    // Update last used timestamp
    await pool.query(
      'UPDATE customer_auth_tokens SET last_used = CURRENT_TIMESTAMP WHERE refresh_token = $1',
      [refreshToken]
    );

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        id: decoded.id,
        email: decoded.email,
        role: 'customer',
        isCustomer: true,
        deviceId: decoded.deviceId,
        sessionId: decoded.sessionId
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
};

/**
 * Logout customer (revoke refresh token)
 */
export const logoutCustomer = async (
  req: CustomerRequest,
  res: Response
) => {
  try {
    const { refreshToken } = req.body;
    const userId = req.user?.id;

    if (!refreshToken || !userId) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Delete refresh token from database
    await pool.query(
      'DELETE FROM customer_auth_tokens WHERE refresh_token = $1 AND user_id = $2',
      [refreshToken, userId]
    );

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

/**
 * Optional middleware for public endpoints that can use auth if provided
 */
export const optionalCustomerAuth = async (
  req: CustomerRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided, continue without auth
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as CustomerTokenPayload;
    
    if (decoded.isCustomer) {
      req.user = decoded;
      req.deviceId = decoded.deviceId;
    }
  } catch (error) {
    // Invalid token, continue without auth
    console.log('Optional auth: Invalid token provided');
  }

  next();
};

export default authenticateCustomer;