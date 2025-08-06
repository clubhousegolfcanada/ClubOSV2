import { body, param, query, ValidationChain } from 'express-validator';

/**
 * Common Validation Helpers
 * 
 * Reusable validation patterns to reduce duplication
 * and ensure consistent validation across the application
 */

// Common regex patterns
export const PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[1-9]\d{1,14}$/, // E.164 format
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  SLUG: /^[a-z0-9-]+$/,
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
};

// Common field validators
export const validators = {
  // Email validation
  email: (field: string = 'email'): ValidationChain => 
    body(field)
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail()
      .isLength({ max: 255 }).withMessage('Email too long'),

  // Password validation
  password: (field: string = 'password', required: boolean = true): ValidationChain => {
    let chain = body(field);
    if (required) {
      chain = chain.notEmpty().withMessage('Password is required');
    }
    return chain
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(PATTERNS.PASSWORD_STRONG)
      .withMessage('Password must contain uppercase, lowercase, number and special character');
  },

  // Phone validation
  phone: (field: string = 'phone', required: boolean = false): ValidationChain => {
    let chain = body(field).trim();
    if (required) {
      chain = chain.notEmpty().withMessage('Phone number is required');
    }
    return chain
      .optional({ nullable: true })
      .matches(PATTERNS.PHONE).withMessage('Invalid phone number format');
  },

  // UUID validation
  uuid: (field: string, location: 'body' | 'param' | 'query' = 'param'): ValidationChain => {
    const validator = location === 'body' ? body : location === 'param' ? param : query;
    return validator(field)
      .notEmpty().withMessage(`${field} is required`)
      .matches(PATTERNS.UUID).withMessage(`Invalid ${field} format`);
  },

  // String field validation
  string: (field: string, options: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
    location?: 'body' | 'param' | 'query';
  } = {}): ValidationChain => {
    const { 
      required = true, 
      min = 1, 
      max = 1000, 
      pattern,
      location = 'body' 
    } = options;
    
    const validator = location === 'body' ? body : location === 'param' ? param : query;
    let chain = validator(field).trim();
    
    if (required) {
      chain = chain.notEmpty().withMessage(`${field} is required`);
    } else {
      chain = chain.optional({ nullable: true });
    }
    
    chain = chain
      .isString().withMessage(`${field} must be a string`)
      .isLength({ min, max }).withMessage(`${field} must be between ${min} and ${max} characters`);
    
    if (pattern) {
      chain = chain.matches(pattern).withMessage(`${field} has invalid format`);
    }
    
    return chain;
  },

  // Number field validation
  number: (field: string, options: {
    required?: boolean;
    min?: number;
    max?: number;
    integer?: boolean;
    location?: 'body' | 'param' | 'query';
  } = {}): ValidationChain => {
    const { 
      required = true, 
      min, 
      max, 
      integer = false,
      location = 'body' 
    } = options;
    
    const validator = location === 'body' ? body : location === 'param' ? param : query;
    let chain = validator(field);
    
    if (required) {
      chain = chain.notEmpty().withMessage(`${field} is required`);
    } else {
      chain = chain.optional({ nullable: true });
    }
    
    if (integer) {
      chain = chain.isInt().withMessage(`${field} must be an integer`);
    } else {
      chain = chain.isNumeric().withMessage(`${field} must be a number`);
    }
    
    if (min !== undefined) {
      chain = chain.isFloat({ min }).withMessage(`${field} must be at least ${min}`);
    }
    
    if (max !== undefined) {
      chain = chain.isFloat({ max }).withMessage(`${field} must be at most ${max}`);
    }
    
    return chain;
  },

  // Boolean field validation
  boolean: (field: string, location: 'body' | 'param' | 'query' = 'body'): ValidationChain => {
    const validator = location === 'body' ? body : location === 'param' ? param : query;
    return validator(field)
      .optional({ nullable: true })
      .isBoolean().withMessage(`${field} must be a boolean`);
  },

  // Date field validation
  date: (field: string, options: {
    required?: boolean;
    after?: Date | string;
    before?: Date | string;
    location?: 'body' | 'param' | 'query';
  } = {}): ValidationChain => {
    const { required = true, after, before, location = 'body' } = options;
    
    const validator = location === 'body' ? body : location === 'param' ? param : query;
    let chain = validator(field);
    
    if (required) {
      chain = chain.notEmpty().withMessage(`${field} is required`);
    } else {
      chain = chain.optional({ nullable: true });
    }
    
    chain = chain.isISO8601().withMessage(`${field} must be a valid date`);
    
    if (after) {
      chain = chain.isAfter(after.toString()).withMessage(`${field} must be after ${after}`);
    }
    
    if (before) {
      chain = chain.isBefore(before.toString()).withMessage(`${field} must be before ${before}`);
    }
    
    return chain;
  },

  // Array field validation
  array: (field: string, options: {
    required?: boolean;
    min?: number;
    max?: number;
    location?: 'body' | 'param' | 'query';
  } = {}): ValidationChain => {
    const { required = true, min = 0, max = 100, location = 'body' } = options;
    
    const validator = location === 'body' ? body : location === 'param' ? param : query;
    let chain = validator(field);
    
    if (required) {
      chain = chain.notEmpty().withMessage(`${field} is required`);
    } else {
      chain = chain.optional({ nullable: true });
    }
    
    return chain
      .isArray({ min, max })
      .withMessage(`${field} must be an array with ${min}-${max} items`);
  },

  // Enum field validation
  enum: (field: string, values: any[], options: {
    required?: boolean;
    location?: 'body' | 'param' | 'query';
  } = {}): ValidationChain => {
    const { required = true, location = 'body' } = options;
    
    const validator = location === 'body' ? body : location === 'param' ? param : query;
    let chain = validator(field);
    
    if (required) {
      chain = chain.notEmpty().withMessage(`${field} is required`);
    } else {
      chain = chain.optional({ nullable: true });
    }
    
    return chain
      .isIn(values)
      .withMessage(`${field} must be one of: ${values.join(', ')}`);
  }
};

// Common validation chains for reuse
export const commonValidations = {
  // Pagination
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
      .toInt()
  ],

  // Sorting
  sorting: (allowedFields: string[]) => [
    query('sortBy')
      .optional()
      .isIn(allowedFields)
      .withMessage(`Sort field must be one of: ${allowedFields.join(', ')}`),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc')
  ],

  // Date range
  dateRange: [
    validators.date('startDate', { required: false, location: 'query' }),
    validators.date('endDate', { required: false, location: 'query' })
  ],

  // Search
  search: [
    query('search')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search term must be between 1 and 100 characters')
  ]
};

// Helper to sanitize user input
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove potential XSS vectors
    return input
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
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
}