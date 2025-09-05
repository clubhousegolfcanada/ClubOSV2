import { body, param, ValidationChain } from 'express-validator';

/**
 * Validation rules for authentication endpoints
 */

export const validateLogin: ValidationChain[] = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
];

export const validateSignup: ValidationChain[] = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\-\+\(\)]+$/).withMessage('Invalid phone number format'),
  body('role')
    .optional()
    .isIn(['customer']).withMessage('Only customer registration is allowed through this endpoint')
];

export const validateForgotPassword: ValidationChain[] = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail()
];

export const validateResetPassword: ValidationChain[] = [
  body('token')
    .trim()
    .notEmpty().withMessage('Reset token is required')
    .isLength({ min: 32 }).withMessage('Invalid reset token'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
];

export const validateChangePassword: ValidationChain[] = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .custom((value, { req }) => value !== req.body.currentPassword)
    .withMessage('New password must be different from current password')
];

export const validateVerifyEmail: ValidationChain[] = [
  body('token')
    .trim()
    .notEmpty().withMessage('Verification token is required')
    .isLength({ min: 32 }).withMessage('Invalid verification token')
];

export const validateRefreshToken: ValidationChain[] = [
  body('refreshToken')
    .trim()
    .notEmpty().withMessage('Refresh token is required')
];

export const validateAdminCreateUser: ValidationChain[] = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['admin', 'operator', 'support', 'kiosk', 'customer'])
    .withMessage('Invalid role'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\-\+\(\)]+$/).withMessage('Invalid phone number format'),
  body('location_id')
    .optional()
    .isUUID().withMessage('Invalid location ID'),
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean')
];

export const validateResendVerification: ValidationChain[] = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail()
];

export const validateRevokeSession: ValidationChain[] = [
  param('sessionId')
    .notEmpty().withMessage('Session ID is required')
    .isUUID().withMessage('Invalid session ID')
];

/**
 * Password strength validator
 * Can be used as a custom validator in other validation chains
 */
export const passwordStrengthValidator = (password: string): boolean => {
  if (!password || password.length < 6) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
};

/**
 * Email domain validator
 * Can be used to restrict signups to specific domains
 */
export const emailDomainValidator = (allowedDomains: string[]) => {
  return (email: string): boolean => {
    const domain = email.split('@')[1];
    return allowedDomains.includes(domain);
  };
};