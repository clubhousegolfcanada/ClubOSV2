import { body, param, query, ValidationChain } from 'express-validator';

/**
 * Validate create user request
 */
export const validateCreateUser: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .trim(),
  body('role')
    .optional()
    .isIn(['admin', 'operator', 'support', 'kiosk', 'customer'])
    .withMessage('Invalid role'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Invalid phone number')
];

/**
 * Validate update user request
 */
export const validateUpdateUser: ValidationChain[] = [
  param('userId')
    .isUUID()
    .withMessage('Invalid user ID'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .trim(),
  body('role')
    .optional()
    .isIn(['admin', 'operator', 'support', 'kiosk', 'customer'])
    .withMessage('Invalid role'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Invalid phone number'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'pending', 'suspended'])
    .withMessage('Invalid status'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be boolean')
];

/**
 * Validate get user by ID
 */
export const validateGetUser: ValidationChain[] = [
  param('userId')
    .isUUID()
    .withMessage('Invalid user ID')
];

/**
 * Validate delete user
 */
export const validateDeleteUser: ValidationChain[] = [
  param('userId')
    .isUUID()
    .withMessage('Invalid user ID')
];

/**
 * Validate reset password
 */
export const validateResetPassword: ValidationChain[] = [
  param('userId')
    .isUUID()
    .withMessage('Invalid user ID'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase and number')
];

/**
 * Validate user search
 */
export const validateSearchUsers: ValidationChain[] = [
  query('q')
    .notEmpty()
    .withMessage('Search query is required')
    .trim(),
  query('role')
    .optional()
    .isIn(['admin', 'operator', 'support', 'kiosk', 'customer'])
    .withMessage('Invalid role'),
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'pending', 'suspended'])
    .withMessage('Invalid status'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

/**
 * Validate pagination
 */
export const validatePagination: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('role')
    .optional()
    .isIn(['admin', 'operator', 'support', 'kiosk', 'customer'])
    .withMessage('Invalid role filter'),
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'pending', 'suspended'])
    .withMessage('Invalid status filter'),
  query('search')
    .optional()
    .trim()
];

/**
 * Validate bulk update
 */
export const validateBulkUpdate: ValidationChain[] = [
  body('userIds')
    .isArray({ min: 1 })
    .withMessage('User IDs must be a non-empty array'),
  body('userIds.*')
    .isUUID()
    .withMessage('Each user ID must be a valid UUID'),
  body('updates')
    .isObject()
    .withMessage('Updates must be an object'),
  body('updates.role')
    .optional()
    .isIn(['admin', 'operator', 'support', 'kiosk', 'customer'])
    .withMessage('Invalid role'),
  body('updates.status')
    .optional()
    .isIn(['active', 'inactive', 'pending', 'suspended'])
    .withMessage('Invalid status'),
  body('updates.is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be boolean')
];

/**
 * Validate approve/reject user
 */
export const validateApproveReject: ValidationChain[] = [
  param('userId')
    .isUUID()
    .withMessage('Invalid user ID')
];

/**
 * Validate export users
 */
export const validateExportUsers: ValidationChain[] = [
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be json or csv'),
  query('role')
    .optional()
    .isIn(['admin', 'operator', 'support', 'kiosk', 'customer'])
    .withMessage('Invalid role filter'),
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'pending', 'suspended'])
    .withMessage('Invalid status filter')
];

/**
 * Validate user activity
 */
export const validateUserActivity: ValidationChain[] = [
  param('userId')
    .isUUID()
    .withMessage('Invalid user ID'),
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365')
];