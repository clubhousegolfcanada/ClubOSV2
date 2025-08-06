import { Response } from 'express';
import { logger } from './logger';

/**
 * Standardized API Response Helpers
 * 
 * Provides consistent response patterns across the application
 * to reduce code duplication and ensure uniform API responses
 */

interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  metadata?: {
    timestamp?: string;
    version?: string;
    [key: string]: any;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  code?: string;
  details?: any;
  timestamp?: string;
}

interface PaginatedResponse<T = any> extends SuccessResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Send a successful response
 */
export function sendSuccess<T = any>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
  metadata?: any
): Response {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    message,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata
    }
  };

  return res.status(statusCode).json(response);
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): Response {
  const response: ErrorResponse = {
    success: false,
    error: code || 'ERROR',
    message,
    code,
    details: process.env.NODE_ENV === 'development' ? details : undefined,
    timestamp: new Date().toISOString()
  };

  // Log the error
  logger.error('API Error Response', {
    statusCode,
    code,
    message,
    details
  });

  return res.status(statusCode).json(response);
}

/**
 * Send a paginated response
 */
export function sendPaginated<T = any>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): Response {
  const totalPages = Math.ceil(total / limit);
  
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    message,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  };

  return res.status(200).json(response);
}

/**
 * Send a created response (201)
 */
export function sendCreated<T = any>(
  res: Response,
  data: T,
  message: string = 'Resource created successfully'
): Response {
  return sendSuccess(res, data, message, 201);
}

/**
 * Send a no content response (204)
 */
export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

/**
 * Send a bad request response (400)
 */
export function sendBadRequest(
  res: Response,
  message: string = 'Bad request',
  details?: any
): Response {
  return sendError(res, message, 400, 'BAD_REQUEST', details);
}

/**
 * Send an unauthorized response (401)
 */
export function sendUnauthorized(
  res: Response,
  message: string = 'Unauthorized'
): Response {
  return sendError(res, message, 401, 'UNAUTHORIZED');
}

/**
 * Send a forbidden response (403)
 */
export function sendForbidden(
  res: Response,
  message: string = 'Forbidden'
): Response {
  return sendError(res, message, 403, 'FORBIDDEN');
}

/**
 * Send a not found response (404)
 */
export function sendNotFound(
  res: Response,
  message: string = 'Resource not found'
): Response {
  return sendError(res, message, 404, 'NOT_FOUND');
}

/**
 * Send a conflict response (409)
 */
export function sendConflict(
  res: Response,
  message: string = 'Resource conflict'
): Response {
  return sendError(res, message, 409, 'CONFLICT');
}

/**
 * Send a validation error response (422)
 */
export function sendValidationError(
  res: Response,
  errors: any,
  message: string = 'Validation failed'
): Response {
  return sendError(res, message, 422, 'VALIDATION_ERROR', errors);
}

/**
 * Handle async route handlers and catch errors
 */
export function asyncHandler(fn: Function) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Standard try-catch wrapper with logging
 */
export async function tryCatch<T>(
  operation: () => Promise<T>,
  errorMessage: string,
  errorCode?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.error(errorMessage, { error, code: errorCode });
    throw error;
  }
}