import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  revokeGoogleAccess,
  isEmailAllowed
} from '../services/googleAuth';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * GET /api/auth/google
 * Initiates Google OAuth flow by redirecting to Google's consent screen
 */
router.get('/google', (req: Request, res: Response) => {
  try {
    // Get remember me preference and user type from query params
    const rememberMe = req.query.remember_me === 'true';
    const userType = (req.query.user_type as string) || 'operator';

    // Validate user type
    if (!['operator', 'customer'].includes(userType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user type'
      });
    }

    // Generate Google OAuth URL
    const authUrl = getGoogleAuthUrl();

    // Store preferences in state parameter
    const stateParam = Buffer.from(JSON.stringify({
      rememberMe,
      userType,
      timestamp: Date.now()
    })).toString('base64');

    // Append state to URL
    const urlWithState = `${authUrl}&state=${stateParam}`;

    logger.info('Initiating Google OAuth flow', {
      userType,
      rememberMe,
      ip: req.ip
    });

    // Return URL for frontend to redirect
    res.json({
      success: true,
      data: {
        authUrl: urlWithState
      }
    });
  } catch (error: any) {
    logger.error('Failed to generate Google auth URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate Google sign-in',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/google/callback
 * Handles the OAuth callback from Google
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: googleError } = req.query;

    // Handle Google errors
    if (googleError) {
      logger.error('Google OAuth error:', googleError);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(`${frontendUrl}/login?error=${googleError}`);
    }

    if (!code || typeof code !== 'string') {
      logger.error('No authorization code received');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(`${frontendUrl}/login?error=no_code`);
    }

    // Parse state parameter
    let rememberMe = false;
    let userType: 'operator' | 'customer' = 'operator';
    if (state && typeof state === 'string') {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        rememberMe = stateData.rememberMe || false;
        userType = stateData.userType || 'operator';
      } catch (e) {
        logger.warn('Failed to parse state parameter:', e);
      }
    }

    // Handle the callback
    const result = await handleGoogleCallback(
      code,
      rememberMe,
      userType,
      req.ip,
      req.headers['user-agent']
    );

    // Redirect to frontend with token
    // In production, you might want to use a more secure method
    const redirectUrl = new URL('/auth/success', process.env.FRONTEND_URL || 'http://localhost:3001');
    redirectUrl.searchParams.append('token', result.token);
    redirectUrl.searchParams.append('user', JSON.stringify({
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
      picture: result.user.picture
    }));

    logger.info('Google OAuth successful', {
      userId: result.user.id,
      email: result.user.email
    });

    res.redirect(redirectUrl.toString());
  } catch (error: any) {
    logger.error('Google OAuth callback failed:', error);

    // Redirect to login with error
    const errorMessage = encodeURIComponent(error.message || 'Authentication failed');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/login?error=oauth_failed&message=${errorMessage}`);
  }
});

/**
 * POST /api/auth/google/token
 * Alternative endpoint for frontend-handled OAuth flow
 * Accepts ID token from frontend Google Sign-In
 */
router.post('/google/token', async (req: Request, res: Response) => {
  try {
    const { idToken, rememberMe = false, userType = 'operator' } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: 'ID token required'
      });
    }

    // Import required functions
    const { verifyGoogleToken, findOrCreateGoogleUser, logOAuthAttempt } =
      await import('../services/googleAuth');
    const { generateToken } = await import('../middleware/auth');
    const { v4: uuidv4 } = await import('uuid');

    // Verify token
    const googleUser = await verifyGoogleToken(idToken);

    const isCustomer = userType === 'customer';

    // Check if email is allowed
    if (!isEmailAllowed(googleUser.email, isCustomer)) {
      await logOAuthAttempt(
        googleUser.email,
        googleUser.id,
        false,
        isCustomer ? 'Invalid email' : 'Domain not allowed',
        undefined,
        req.ip,
        req.headers['user-agent']
      );

      return res.status(403).json({
        success: false,
        error: isCustomer ? 'Invalid email' : 'Domain not allowed',
        message: isCustomer
          ? 'Invalid email address'
          : 'Only Clubhouse email addresses are permitted'
      });
    }

    // Find or create user
    const user = await findOrCreateGoogleUser(googleUser, userType);

    // Generate JWT token
    const jwtToken = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: uuidv4(),
      name: user.name,
      phone: user.phone
    }, rememberMe);

    // Log successful attempt
    await logOAuthAttempt(
      googleUser.email,
      googleUser.id,
      true,
      undefined,
      user.id,
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          phone: user.phone,
          picture: user.oauth_picture_url
        },
        token: jwtToken
      }
    });
  } catch (error: any) {
    logger.error('Google token verification failed:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: error.message
    });
  }
});

/**
 * DELETE /api/auth/google/revoke
 * Revokes Google OAuth access for the current user
 */
router.delete('/google/revoke', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    await revokeGoogleAccess(req.user.id);

    res.json({
      success: true,
      message: 'Google access revoked successfully'
    });
  } catch (error: any) {
    logger.error('Failed to revoke Google access:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke Google access',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/google/check-email
 * Checks if an email is allowed for Google sign-in
 */
router.get('/google/check-email', (req: Request, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Email required'
      });
    }

    const allowed = isEmailAllowed(email);

    res.json({
      success: true,
      data: {
        email,
        allowed,
        message: allowed
          ? 'Email is authorized for Google sign-in'
          : 'Email domain not authorized. Only Clubhouse emails are permitted.'
      }
    });
  } catch (error: any) {
    logger.error('Email check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check email',
      message: error.message
    });
  }
});

export default router;