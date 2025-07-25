import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logger.warn('Validation failed', {
      path: req.path,
      method: req.method,
      errors: errors.array()
    });

    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      errors: errors.array().map(err => ({
        field: err.type === 'field' ? err.path : err.type,
        message: err.msg
      }))
    });
  }
  
  next();
};

// Common validation chains
export const commonValidations = {
  // ID validation
  id: param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
  
  // Pagination
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  
  // Date range
  dateRange: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date')
      .custom((value, { req }) => {
        if (req.query?.startDate && value) {
          return new Date(value) >= new Date(req.query.startDate);
        }
        return true;
      })
      .withMessage('End date must be after start date')
  ]
};

// Request validation schemas
export const requestValidation = {
  // LLM request validation
  llmRequest: [
    body('requestDescription')
      .trim()
      .notEmpty()
      .withMessage('Request description is required')
      .isLength({ min: 10, max: 5000 })
      .withMessage('Request description must be between 10 and 5000 characters'),
    body('location')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Location must be less than 200 characters'),
    body('routePreference')
      .optional()
      .isIn(['Auto', 'Booking&Access', 'Emergency', 'TechSupport', 'BrandTone'])
      .withMessage('Invalid route preference'),
    body('smartAssistEnabled')
      .optional()
      .isBoolean()
      .withMessage('Smart assist enabled must be a boolean')
      .toBoolean(), // Convert to boolean
    body('clientStartTime')
      .optional()
      .isInt()
      .withMessage('Client start time must be an integer')
  ],
  
  // Slack message validation
  slackMessage: [
    body('requestDescription')
      .trim()
      .notEmpty()
      .withMessage('Request description is required')
      .isLength({ min: 10, max: 5000 })
      .withMessage('Request description must be between 10 and 5000 characters')
      .escape(),
    body('location')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Location must be less than 200 characters')
      .escape()
  ],
  
  // Booking validation
  createBooking: [
    body('userId')
      .trim()
      .notEmpty()
      .withMessage('User ID is required')
      .isUUID()
      .withMessage('Invalid user ID format'),
    body('simulatorId')
      .trim()
      .notEmpty()
      .withMessage('Simulator ID is required'),
    body('startTime')
      .notEmpty()
      .withMessage('Start time is required')
      .isISO8601()
      .withMessage('Start time must be a valid ISO 8601 date')
      .custom((value) => {
        return new Date(value) > new Date();
      })
      .withMessage('Start time must be in the future'),
    body('duration')
      .isInt({ min: 30, max: 240 })
      .withMessage('Duration must be between 30 and 240 minutes'),
    body('type')
      .isIn(['single', 'recurring'])
      .withMessage('Type must be either single or recurring'),
    body('recurringDays')
      .if(body('type').equals('recurring'))
      .isArray({ min: 1, max: 7 })
      .withMessage('Recurring days must be an array with 1-7 elements')
      .custom((value) => {
        return value.every((day: number) => day >= 0 && day <= 6);
      })
      .withMessage('Recurring days must be between 0 (Sunday) and 6 (Saturday)')
  ],
  
  // Access request validation
  accessRequest: [
    body('userId')
      .trim()
      .notEmpty()
      .withMessage('User ID is required')
      .isUUID()
      .withMessage('Invalid user ID format'),
    body('accessType')
      .isIn(['door', 'equipment', 'system'])
      .withMessage('Access type must be door, equipment, or system'),
    body('location')
      .trim()
      .notEmpty()
      .withMessage('Location is required')
      .isLength({ max: 200 })
      .withMessage('Location must be less than 200 characters')
      .escape(),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason must be less than 500 characters')
      .escape()
  ]
};

// Custom validators
export const customValidators = {
  // Validate JSON
  isValidJSON: (value: string) => {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  },
  
  // Validate email
  isEmail: body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Invalid email address'),
  
  // Validate phone number
  isPhoneNumber: body('phone')
    .trim()
    .matches(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)
    .withMessage('Invalid phone number'),
  
  // Validate URL
  isURL: body('url')
    .trim()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Invalid URL'),
  
  // Validate strong password
  isStrongPassword: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character')
};

// Sanitization helpers
export const sanitizeInput = {
  // Escape HTML
  escapeHtml: (value: string): string => {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    
    return value.replace(/[&<>"'/]/g, (char) => map[char]);
  },
  
  // Remove script tags
  removeScripts: (value: string): string => {
    return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  },
  
  // Sanitize filename
  sanitizeFilename: (filename: string): string => {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .substring(0, 255);
  }
};

// Create validation middleware
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));
    
    // Check for errors
    handleValidationErrors(req, res, next);
  };
};