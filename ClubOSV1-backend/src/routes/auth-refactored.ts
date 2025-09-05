import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { authRateLimiter } from '../middleware/rateLimiter';
import { passwordChangeLimiter } from '../middleware/passwordChangeLimiter';
import {
  validateLogin,
  validateSignup,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
  validateVerifyEmail,
  validateRefreshToken,
  validateAdminCreateUser,
  validateResendVerification,
  validateRevokeSession
} from '../validators/authValidators';

const router = Router();
const authController = new AuthController();

/**
 * Public authentication routes
 * Clean routing with validation and rate limiting
 * All business logic is in AuthController/AuthService
 */

// Public routes - no authentication required
router.post('/login', 
  authRateLimiter, 
  validate(validateLogin), 
  authController.login
);

router.post('/signup', 
  authRateLimiter, 
  validate(validateSignup), 
  authController.signup
);

router.post('/forgot-password', 
  authRateLimiter, 
  validate(validateForgotPassword), 
  authController.forgotPassword
);

router.post('/reset-password', 
  authRateLimiter, 
  validate(validateResetPassword), 
  authController.resetPassword
);

router.post('/verify-email', 
  authRateLimiter, 
  validate(validateVerifyEmail), 
  authController.verifyEmail
);

router.post('/refresh', 
  authRateLimiter, 
  validate(validateRefreshToken), 
  authController.refreshToken
);

router.post('/resend-verification', 
  authRateLimiter, 
  validate(validateResendVerification), 
  authController.resendVerification
);

// Protected routes - authentication required
router.post('/logout', 
  authenticate, 
  authController.logout
);

router.get('/me', 
  authenticate, 
  authController.getCurrentUser
);

router.get('/check', 
  authenticate, 
  authController.checkAuth
);

router.post('/change-password', 
  authenticate, 
  passwordChangeLimiter, 
  validate(validateChangePassword), 
  authController.changePassword
);

router.get('/sessions', 
  authenticate, 
  authController.getSessions
);

router.delete('/sessions/:sessionId', 
  authenticate, 
  validate(validateRevokeSession), 
  authController.revokeSession
);

// Admin routes - admin role required
router.post('/admin/create-user', 
  authenticate, 
  roleGuard(['admin']), 
  validate(validateAdminCreateUser), 
  authController.adminCreateUser
);

export default router;