import { Response } from 'express';

interface SuccessResponse {
  success: true;
  message: string;
  data: any;
  timestamp: string;
}

interface ErrorResponse {
  success: false;
  message: string;
  error?: any;
  timestamp: string;
}

interface PaginatedResponse extends SuccessResponse {
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
 * Standardized API response utility class
 * Ensures consistent response format across all endpoints
 */
export class ApiResponse {
  /**
   * Send a successful response
   */
  static success(res: Response, data: any, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    } as SuccessResponse);
  }

  /**
   * Send an error response
   */
  static error(res: Response, message: string, statusCode = 500, error?: any) {
    const response: ErrorResponse = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };

    if (error) {
      response.error = process.env.NODE_ENV === 'production' 
        ? error.message || 'An error occurred'
        : error;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Send a paginated response
   */
  static paginated(res: Response, data: any[], page: number, limit: number, total: number) {
    return res.status(200).json({
      success: true,
      message: 'Success',
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      timestamp: new Date().toISOString()
    } as PaginatedResponse);
  }

  /**
   * Send a created response (201)
   */
  static created(res: Response, data: any, message = 'Created successfully') {
    return this.success(res, data, message, 201);
  }

  /**
   * Send a no content response (204)
   */
  static noContent(res: Response) {
    return res.status(204).send();
  }

  /**
   * Send a bad request response (400)
   */
  static badRequest(res: Response, message = 'Bad request', error?: any) {
    return this.error(res, message, 400, error);
  }

  /**
   * Send an unauthorized response (401)
   */
  static unauthorized(res: Response, message = 'Unauthorized') {
    return this.error(res, message, 401);
  }

  /**
   * Send a forbidden response (403)
   */
  static forbidden(res: Response, message = 'Forbidden') {
    return this.error(res, message, 403);
  }

  /**
   * Send a not found response (404)
   */
  static notFound(res: Response, message = 'Resource not found') {
    return this.error(res, message, 404);
  }

  /**
   * Send a conflict response (409)
   */
  static conflict(res: Response, message = 'Resource conflict') {
    return this.error(res, message, 409);
  }

  /**
   * Send a validation error response (422)
   */
  static validationError(res: Response, message = 'Validation error', errors?: any) {
    return this.error(res, message, 422, errors);
  }

  /**
   * Send a too many requests response (429)
   */
  static tooManyRequests(res: Response, message = 'Too many requests') {
    return this.error(res, message, 429);
  }

  /**
   * Send an internal server error response (500)
   */
  static serverError(res: Response, error?: any) {
    return this.error(res, 'Internal server error', 500, error);
  }
}