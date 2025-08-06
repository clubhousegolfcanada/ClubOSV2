/**
 * Enhanced Error Handling Middleware
 * 
 * Provides centralized error handling with consistent response formatting
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { errorResponse } from '../utils/responseHelpers';
import { ValidationError } from 'express-validator';

/**
 * Standard error types with predefined status codes
 */
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR'
}

/**
 * Custom application error class
 */
export class ApplicationError extends Error {
  constructor(
    public message: string,
    public type: ErrorType,
    public statusCode: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

/**
 * Map error types to HTTP status codes
 */
const errorStatusMap: Record<ErrorType, number> = {
  [ErrorType.VALIDATION]: 400,
  [ErrorType.AUTHENTICATION]: 401,
  [ErrorType.AUTHORIZATION]: 403,
  [ErrorType.NOT_FOUND]: 404,
  [ErrorType.CONFLICT]: 409,
  [ErrorType.RATE_LIMIT]: 429,
  [ErrorType.SERVER_ERROR]: 500,
  [ErrorType.DATABASE_ERROR]: 500,
  [ErrorType.EXTERNAL_API_ERROR]: 502
};

/**
 * Central error handling middleware
 */
export function errorHandler(
  error: Error | ApplicationError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Don't handle if response already sent
  if (res.headersSent) {
    return next(error);
  }

  // Log error details
  logger.error('Request error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body,
    user: (req as any).user?.id
  });

  // Handle known application errors
  if (error instanceof ApplicationError) {
    res.status(error.statusCode).json(
      errorResponse(
        error.message,
        error.statusCode,
        error.code,
        process.env.NODE_ENV === 'development' ? error.details : undefined
      )
    );
    return;
  }

  // Handle database errors
  if (error.name === 'QueryFailedError' || error.message?.includes('database')) {
    res.status(500).json(
      errorResponse(
        'Database operation failed',
        500,
        ErrorType.DATABASE_ERROR,
        process.env.NODE_ENV === 'development' ? error.message : undefined
      )
    );
    return;
  }

  // Handle validation errors from express-validator
  if (Array.isArray((error as any).errors)) {
    const validationErrors = (error as any).errors as ValidationError[];
    res.status(400).json(
      errorResponse(
        'Validation failed',
        400,
        ErrorType.VALIDATION,
        validationErrors.map(e => ({
          field: (e as any).param,
          message: e.msg
        }))
      )
    );
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    res.status(401).json(
      errorResponse(
        'Authentication failed',
        401,
        ErrorType.AUTHENTICATION
      )
    );
    return;
  }

  // Default to 500 error
  res.status(500).json(
    errorResponse(
      'An unexpected error occurred',
      500,
      ErrorType.SERVER_ERROR,
      process.env.NODE_ENV === 'development' ? error.stack : undefined
    )
  );
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Database error handler
 */
export function handleDatabaseError(error: any): ApplicationError {
  // PostgreSQL error codes
  const pgErrorMap: Record<string, { message: string; type: ErrorType; status: number }> = {
    '23505': { 
      message: 'A record with this value already exists', 
      type: ErrorType.CONFLICT, 
      status: 409 
    },
    '23503': { 
      message: 'Referenced record does not exist', 
      type: ErrorType.VALIDATION, 
      status: 400 
    },
    '22P02': { 
      message: 'Invalid input format', 
      type: ErrorType.VALIDATION, 
      status: 400 
    },
    '42703': { 
      message: 'Column does not exist', 
      type: ErrorType.DATABASE_ERROR, 
      status: 500 
    },
    '42P01': { 
      message: 'Table does not exist', 
      type: ErrorType.DATABASE_ERROR, 
      status: 500 
    }
  };

  const pgError = pgErrorMap[error.code];
  if (pgError) {
    return new ApplicationError(
      pgError.message,
      pgError.type,
      pgError.status,
      error.code,
      process.env.NODE_ENV === 'development' ? error.detail : undefined
    );
  }

  return new ApplicationError(
    'Database operation failed',
    ErrorType.DATABASE_ERROR,
    500,
    error.code,
    process.env.NODE_ENV === 'development' ? error.message : undefined
  );
}

/**
 * External API error handler
 */
export function handleExternalAPIError(
  serviceName: string,
  error: any
): ApplicationError {
  const status = error.response?.status || 502;
  const message = error.response?.data?.message || 
                  error.response?.data?.error || 
                  `${serviceName} service unavailable`;

  // Map external service status codes
  let errorType = ErrorType.EXTERNAL_API_ERROR;
  let statusCode = 502;

  if (status === 429) {
    errorType = ErrorType.RATE_LIMIT;
    statusCode = 503; // Service unavailable due to rate limit
  } else if (status >= 400 && status < 500) {
    errorType = ErrorType.VALIDATION;
    statusCode = 400;
  }

  return new ApplicationError(
    message,
    errorType,
    statusCode,
    error.response?.data?.code,
    process.env.NODE_ENV === 'development' ? error.response?.data : undefined
  );
}

/**
 * Not found error handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(
    errorResponse(
      `Route ${req.method} ${req.path} not found`,
      404,
      ErrorType.NOT_FOUND
    )
  );
}