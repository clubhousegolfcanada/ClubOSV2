import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { ApiResponse } from './ApiResponse';
import { asyncHandler } from './asyncHandler';

/**
 * Base controller class that all controllers should extend
 * Provides common functionality and standardized response methods
 */
export abstract class BaseController {
  /**
   * Wraps controller methods with async handler
   */
  protected handle = asyncHandler;

  /**
   * Standard success response (200)
   */
  protected ok(res: Response, data: any, message?: string) {
    return ApiResponse.success(res, data, message);
  }

  /**
   * Created response (201)
   */
  protected created(res: Response, data: any, message = 'Created successfully') {
    return ApiResponse.created(res, data, message);
  }

  /**
   * No content response (204)
   */
  protected noContent(res: Response) {
    return ApiResponse.noContent(res);
  }

  /**
   * Bad request response (400)
   */
  protected badRequest(res: Response, message: string, error?: any) {
    return ApiResponse.badRequest(res, message, error);
  }

  /**
   * Unauthorized response (401)
   */
  protected unauthorized(res: Response, message = 'Unauthorized') {
    return ApiResponse.unauthorized(res, message);
  }

  /**
   * Forbidden response (403)
   */
  protected forbidden(res: Response, message = 'Forbidden') {
    return ApiResponse.forbidden(res, message);
  }

  /**
   * Not found response (404)
   */
  protected notFound(res: Response, message = 'Resource not found') {
    return ApiResponse.notFound(res, message);
  }

  /**
   * Conflict response (409)
   */
  protected conflict(res: Response, message: string) {
    return ApiResponse.conflict(res, message);
  }

  /**
   * Validation error response (422)
   */
  protected validationError(res: Response, message: string, errors?: any) {
    return ApiResponse.validationError(res, message, errors);
  }

  /**
   * Too many requests response (429)
   */
  protected tooManyRequests(res: Response, message = 'Too many requests') {
    return ApiResponse.tooManyRequests(res, message);
  }

  /**
   * Server error response (500)
   */
  protected serverError(res: Response, error: any) {
    return ApiResponse.serverError(res, error);
  }

  /**
   * Paginated response
   */
  protected paginated(res: Response, data: any[], page: number, limit: number, total: number) {
    return ApiResponse.paginated(res, data, page, limit, total);
  }

  /**
   * Get pagination parameters from request
   */
  protected getPagination(req: Request): { page: number; limit: number; offset: number } {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const offset = (page - 1) * limit;
    
    return { page, limit, offset };
  }

  /**
   * Get sort parameters from request
   */
  protected getSorting(req: Request, allowedFields: string[], defaultField = 'created_at'): { sortBy: string; sortOrder: 'ASC' | 'DESC' } {
    const sortBy = (req.query.sortBy as string) || defaultField;
    const sortOrder = ((req.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC') as 'ASC' | 'DESC';
    
    // Validate sort field
    if (!allowedFields.includes(sortBy)) {
      return { sortBy: defaultField, sortOrder: 'DESC' };
    }
    
    return { sortBy, sortOrder };
  }

  /**
   * Get filters from request query
   */
  protected getFilters(req: Request, allowedFilters: string[]): Record<string, any> {
    const filters: Record<string, any> = {};
    
    for (const key of allowedFilters) {
      if (req.query[key] !== undefined) {
        filters[key] = req.query[key];
      }
    }
    
    return filters;
  }

  /**
   * Validate required fields in request body
   */
  protected validateRequired(body: any, requiredFields: string[]): string[] {
    const missing = requiredFields.filter(field => !body[field]);
    return missing;
  }

  /**
   * Get user from request (assumes auth middleware has run)
   */
  protected getUser(req: Request): any {
    return (req as any).user;
  }

  /**
   * Check if user has required role
   */
  protected hasRole(req: Request, roles: string[]): boolean {
    const user = this.getUser(req);
    if (!user) return false;
    return roles.includes(user.role);
  }

  /**
   * Log activity (audit trail)
   */
  protected async logActivity(
    userId: string,
    action: string,
    entityType: string,
    entityId: string | number,
    details?: any
  ): Promise<void> {
    logger.debug('Activity Log:', {
      userId,
      action,
      entityType,
      entityId,
      details,
      timestamp: new Date().toISOString()
    });
  }
}