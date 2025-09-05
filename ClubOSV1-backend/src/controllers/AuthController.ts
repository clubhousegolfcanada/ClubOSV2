import { Request, Response } from 'express';
import { BaseController } from '../utils/BaseController';
import { AuthService } from '../services/AuthService';
import { logger } from '../utils/logger';

/**
 * Authentication controller handling all auth-related HTTP requests
 * Delegates business logic to AuthService
 */
export class AuthController extends BaseController {
  private authService: AuthService;

  constructor() {
    super();
    this.authService = new AuthService();
  }

  /**
   * POST /api/auth/login
   * User login endpoint
   */
  login = this.handle(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    
    // Validate required fields
    const missing = this.validateRequired(req.body, ['email', 'password']);
    if (missing.length > 0) {
      return this.validationError(res, `Missing required fields: ${missing.join(', ')}`);
    }
    
    const result = await this.authService.login(email, password);
    
    if (!result.success) {
      // Log failed attempt
      logger.warn('Failed login attempt', { 
        email, 
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      
      // Check if account is locked
      if (result.message?.includes('locked')) {
        return this.forbidden(res, result.message);
      }
      
      return this.unauthorized(res, result.message || 'Invalid credentials');
    }
    
    // Log successful login
    await this.logActivity(
      result.data!.user.id,
      'LOGIN',
      'user',
      result.data!.user.id,
      { ip: req.ip }
    );
    
    return this.ok(res, result.data, 'Login successful');
  });

  /**
   * POST /api/auth/signup
   * User registration endpoint (customers only)
   */
  signup = this.handle(async (req: Request, res: Response) => {
    const userData = {
      ...req.body,
      ip: req.ip,
      userAgent: req.get('user-agent')
    };
    
    // Validate required fields
    const missing = this.validateRequired(req.body, ['email', 'password', 'name']);
    if (missing.length > 0) {
      return this.validationError(res, `Missing required fields: ${missing.join(', ')}`);
    }
    
    // Force role to customer for public signup
    if (userData.role && userData.role !== 'customer') {
      return this.forbidden(res, 'Only customer registration is allowed through this endpoint');
    }
    userData.role = 'customer';
    
    const result = await this.authService.signup(userData);
    
    if (!result.success) {
      return this.badRequest(res, result.message || 'Signup failed');
    }
    
    return this.created(res, result.data, 'Account created successfully');
  });

  /**
   * POST /api/auth/logout
   * User logout endpoint
   */
  logout = this.handle(async (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = this.getUser(req);
    
    if (!token || !user) {
      return this.unauthorized(res, 'No active session');
    }
    
    await this.authService.logout(token, user.id);
    
    return this.ok(res, null, 'Logged out successfully');
  });

  /**
   * GET /api/auth/me
   * Get current user information
   */
  getCurrentUser = this.handle(async (req: Request, res: Response) => {
    const user = this.getUser(req);
    
    if (!user) {
      return this.unauthorized(res, 'Not authenticated');
    }
    
    const userData = await this.authService.getUserById(user.id);
    
    if (!userData) {
      return this.notFound(res, 'User not found');
    }
    
    return this.ok(res, userData);
  });

  /**
   * POST /api/auth/forgot-password
   * Request password reset
   */
  forgotPassword = this.handle(async (req: Request, res: Response) => {
    const { email } = req.body;
    
    if (!email) {
      return this.validationError(res, 'Email is required');
    }
    
    const result = await this.authService.requestPasswordReset(email);
    
    // Always return success to prevent email enumeration
    return this.ok(res, null, result.message);
  });

  /**
   * POST /api/auth/reset-password
   * Reset password with token
   */
  resetPassword = this.handle(async (req: Request, res: Response) => {
    const { token, password } = req.body;
    
    const missing = this.validateRequired(req.body, ['token', 'password']);
    if (missing.length > 0) {
      return this.validationError(res, `Missing required fields: ${missing.join(', ')}`);
    }
    
    const result = await this.authService.resetPassword(token, password);
    
    if (!result.success) {
      return this.badRequest(res, result.message);
    }
    
    return this.ok(res, null, result.message);
  });

  /**
   * POST /api/auth/change-password
   * Change password (requires current password)
   */
  changePassword = this.handle(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const user = this.getUser(req);
    
    if (!user) {
      return this.unauthorized(res);
    }
    
    const missing = this.validateRequired(req.body, ['currentPassword', 'newPassword']);
    if (missing.length > 0) {
      return this.validationError(res, `Missing required fields: ${missing.join(', ')}`);
    }
    
    const result = await this.authService.changePassword(user.id, currentPassword, newPassword);
    
    if (!result.success) {
      return this.badRequest(res, result.message);
    }
    
    return this.ok(res, null, result.message);
  });

  /**
   * POST /api/auth/verify-email
   * Verify email with token
   */
  verifyEmail = this.handle(async (req: Request, res: Response) => {
    const { token } = req.body;
    
    if (!token) {
      return this.validationError(res, 'Verification token is required');
    }
    
    const result = await this.authService.verifyEmail(token);
    
    if (!result.success) {
      return this.badRequest(res, result.message);
    }
    
    return this.ok(res, null, result.message);
  });

  /**
   * POST /api/auth/refresh
   * Refresh JWT token
   */
  refreshToken = this.handle(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return this.validationError(res, 'Refresh token is required');
    }
    
    try {
      const decoded = await this.authService.verifyToken(refreshToken);
      
      if (decoded.type !== 'refresh') {
        return this.badRequest(res, 'Invalid refresh token');
      }
      
      const user = await this.authService.getUserById(decoded.id);
      
      if (!user) {
        return this.notFound(res, 'User not found');
      }
      
      // Generate new access token
      const token = await this.authService.generateToken(user);
      
      return this.ok(res, { token }, 'Token refreshed successfully');
    } catch (error) {
      return this.unauthorized(res, 'Invalid or expired refresh token');
    }
  });

  /**
   * GET /api/auth/check
   * Check if authenticated (for frontend)
   */
  checkAuth = this.handle(async (req: Request, res: Response) => {
    const user = this.getUser(req);
    
    if (!user) {
      return this.unauthorized(res, 'Not authenticated');
    }
    
    return this.ok(res, { 
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
  });

  /**
   * POST /api/auth/admin/create-user
   * Admin endpoint to create users with any role
   */
  adminCreateUser = this.handle(async (req: Request, res: Response) => {
    const user = this.getUser(req);
    
    // Check admin role
    if (!this.hasRole(req, ['admin'])) {
      return this.forbidden(res, 'Admin access required');
    }
    
    const userData = {
      ...req.body,
      createdBy: user.id
    };
    
    const missing = this.validateRequired(req.body, ['email', 'password', 'name', 'role']);
    if (missing.length > 0) {
      return this.validationError(res, `Missing required fields: ${missing.join(', ')}`);
    }
    
    // Validate role
    const validRoles = ['admin', 'operator', 'support', 'kiosk', 'customer'];
    if (!validRoles.includes(userData.role)) {
      return this.validationError(res, `Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }
    
    const result = await this.authService.signup(userData);
    
    if (!result.success) {
      return this.badRequest(res, result.message || 'Failed to create user');
    }
    
    // Log admin action
    await this.logActivity(
      user.id,
      'CREATE_USER',
      'user',
      result.data!.user.id,
      { role: userData.role }
    );
    
    return this.created(res, result.data, 'User created successfully');
  });

  /**
   * POST /api/auth/resend-verification
   * Resend email verification
   */
  resendVerification = this.handle(async (req: Request, res: Response) => {
    const { email } = req.body;
    
    if (!email) {
      return this.validationError(res, 'Email is required');
    }
    
    // TODO: Implement resend verification in AuthService
    
    // Always return success to prevent email enumeration
    return this.ok(res, null, 'If an account exists with this email, a verification link has been sent');
  });

  /**
   * GET /api/auth/sessions
   * Get active sessions for current user
   */
  getSessions = this.handle(async (req: Request, res: Response) => {
    const user = this.getUser(req);
    
    if (!user) {
      return this.unauthorized(res);
    }
    
    // TODO: Implement session management in AuthService
    
    return this.ok(res, [], 'No active sessions');
  });

  /**
   * DELETE /api/auth/sessions/:sessionId
   * Revoke a specific session
   */
  revokeSession = this.handle(async (req: Request, res: Response) => {
    const user = this.getUser(req);
    const { sessionId } = req.params;
    
    if (!user) {
      return this.unauthorized(res);
    }
    
    // TODO: Implement session revocation in AuthService
    
    return this.ok(res, null, 'Session revoked');
  });
}