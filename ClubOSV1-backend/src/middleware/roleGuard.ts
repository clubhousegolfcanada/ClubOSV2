import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';
import { logger } from '../utils/logger';

/**
 * Role-based access control middleware
 * Checks if the authenticated user has one of the required roles
 * 
 * @param allowedRoles - Array of roles that can access the route
 * @returns Express middleware function
 */
export const roleGuard = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if user is authenticated
    if (!req.user) {
      logger.warn('Unauthenticated access attempt', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    // Check if user's role is in the allowed roles
    const userRole = req.user.role;
    
    if (!userRole) {
      logger.error('User without role attempted access', {
        userId: req.user.id,
        path: req.path
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'User role not defined'
      });
    }

    // Check if user has permission
    if (!allowedRoles.includes(userRole)) {
      logger.warn('Unauthorized role access attempt', {
        userId: req.user.id,
        userRole: userRole,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: `Access restricted to: ${allowedRoles.join(', ')}`,
        requiredRoles: allowedRoles,
        userRole: userRole
      });
    }

    // User has permission, continue
    // Log at DEBUG level to reduce log volume - successful access is normal
    logger.debug('Role access granted', {
      userId: req.user.id,
      role: userRole,
      path: req.path
    });

    next();
  };
};

/**
 * Shorthand middleware for admin-only routes
 */
export const adminOnly = roleGuard(['admin']);

/**
 * Shorthand middleware for admin and operator routes
 */
export const adminOrOperator = roleGuard(['admin', 'operator']);

/**
 * Shorthand middleware for all authenticated users
 */
export const anyAuthenticated = roleGuard(['admin', 'operator', 'support']);

/**
 * Helper function to check if a user has a specific role
 * Useful for conditional logic within route handlers
 */
export const hasRole = (user: Express.Request['user'], role: UserRole): boolean => {
  return user?.role === role;
};

/**
 * Helper function to check if a user has any of the specified roles
 */
export const hasAnyRole = (user: Express.Request['user'], roles: UserRole[]): boolean => {
  return user ? roles.includes(user.role) : false;
};

/**
 * Role hierarchy helper
 * Returns true if the user's role is equal or higher than the required role
 */
export const hasMinimumRole = (user: Express.Request['user'], minimumRole: UserRole): boolean => {
  if (!user) return false;
  
  const roleHierarchy: Record<UserRole, number> = {
    'customer': 0,
    'kiosk': 1,
    'contractor': 1,  // Same level as kiosk - limited access
    'support': 2,
    'operator': 3,
    'admin': 4
  };

  const userLevel = roleHierarchy[user.role];
  const requiredLevel = roleHierarchy[minimumRole];

  return userLevel >= requiredLevel;
};
