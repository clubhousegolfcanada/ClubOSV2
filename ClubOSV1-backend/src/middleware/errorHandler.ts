import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiError } from '../types';

// Custom error class for application errors
export class AppError extends Error {
  statusCode: number;
  code: string;
  
  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Type guard to check if error is a standard Error with stack
  const isError = err instanceof Error;
  const stack = isError ? err.stack : undefined;
  
  logger.error('Error caught by error handler:', {
    error: err.message,
    stack: stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query
  });

  // Check if error is an AppError with statusCode
  const isAppError = err instanceof AppError;
  
  // Get status code - AppError has statusCode property
  const statusCode = isAppError ? err.statusCode : 500;
  const errorResponse: ApiError = {
    code: isAppError ? err.code : 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    details: process.env.NODE_ENV === 'development' ? stack : undefined
  };

  // Add CORS headers to error responses
  // When credentials are included, we must use the specific origin, not '*'
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, x-csrf-token');
  }
  
  res.status(statusCode).json(errorResponse);
};

