import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { logger } from '../utils/logger';
import * as Sentry from '@sentry/node';

// Validation middleware wrapper
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Log validation errors
    logger.warn('Validation failed', {
      path: req.path,
      errors: errors.array(),
      body: req.body,
      ip: req.ip
    });

    // Track in Sentry
    Sentry.captureMessage('Validation failed', {
      level: 'warning',
      extra: {
        path: req.path,
        errors: errors.array(),
        ip: req.ip
      }
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.type === 'field' ? err.path : undefined,
        message: err.msg
      }))
    });
  };
};

// Sanitize input to prevent XSS and injection attacks
export const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') {
    return input
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const key in input) {
      if (input.hasOwnProperty(key)) {
        sanitized[key] = sanitizeInput(input[key]);
      }
    }
    return sanitized;
  }
  
  return input;
};

// Middleware to sanitize all inputs
export const sanitizeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  req.body = sanitizeInput(req.body);
  req.query = sanitizeInput(req.query);
  req.params = sanitizeInput(req.params);
  next();
};

// Common validation chains
export const commonValidations = {
  // Email validation
  email: (field = 'email') => [
    `${field} must be a valid email address`
  ],
  
  // Password validation
  password: (field = 'password') => [
    `${field} must be at least 8 characters long`,
    `${field} must contain at least one uppercase letter, one lowercase letter, and one number`
  ],
  
  // UUID validation
  uuid: (field = 'id') => [
    `${field} must be a valid UUID`
  ],
  
  // String length validation
  stringLength: (field: string, min: number, max: number) => [
    `${field} must be between ${min} and ${max} characters`
  ],
  
  // Required field validation
  required: (field: string) => [
    `${field} is required`
  ]
};