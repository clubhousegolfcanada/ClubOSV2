/**
 * Route Factory Pattern
 * 
 * Provides a consistent way to create route modules with:
 * - Standardized middleware application
 * - Consistent error handling
 * - Automatic route registration
 * - Built-in validation
 * - Request/response logging
 */

import { Router, RequestHandler } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface RouteHandler {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  handlers: RequestHandler[];
  validation?: RequestHandler;
  description?: string;
}

export interface RouteModuleConfig {
  prefix: string;
  middleware?: RequestHandler[];
  routes: RouteHandler[];
  rateLimiter?: RequestHandler;
  version?: string;
}

export interface RouteModule {
  router: Router;
  prefix: string;
  routes: string[];
}

/**
 * Create a standardized route module
 */
export function createRouteModule(config: RouteModuleConfig): RouteModule {
  const router = Router();
  const registeredRoutes: string[] = [];

  // Apply module-level middleware
  if (config.middleware) {
    config.middleware.forEach(mw => router.use(mw));
  }

  // Apply rate limiter if provided
  if (config.rateLimiter) {
    router.use(config.rateLimiter);
  }

  // Register each route
  config.routes.forEach(route => {
    const handlers: RequestHandler[] = [];

    // Add validation if provided
    if (route.validation) {
      handlers.push(route.validation);
    }

    // Wrap handlers with async error handling
    const wrappedHandlers = route.handlers.map(handler => 
      asyncHandler(async (req, res, next) => {
        // Log route access
        logger.debug(`${route.method.toUpperCase()} ${config.prefix}${route.path}`, {
          user: req.user?.id,
          ip: req.ip,
          description: route.description
        });

        // Execute handler
        return handler(req, res, next);
      })
    );

    handlers.push(...wrappedHandlers);

    // Register route with router
    router[route.method](route.path, ...handlers);

    // Track registered route
    registeredRoutes.push(`${route.method.toUpperCase()} ${config.prefix}${route.path}`);
  });

  // Log module registration
  logger.info(`Route module registered: ${config.prefix}`, {
    routes: registeredRoutes.length,
    version: config.version || 'v1'
  });

  return {
    router,
    prefix: config.prefix,
    routes: registeredRoutes
  };
}

/**
 * Helper to create a health check route
 */
export function createHealthRoute(serviceName: string): RouteHandler {
  return {
    method: 'get',
    path: '/health',
    description: `Health check for ${serviceName}`,
    handlers: [
      (req, res) => {
        res.json({
          service: serviceName,
          status: 'healthy',
          timestamp: new Date().toISOString()
        });
      }
    ]
  };
}

/**
 * Helper to create CRUD routes for a resource
 */
export function createCrudRoutes(
  resourceName: string,
  handlers: {
    list?: RequestHandler;
    create?: RequestHandler;
    get?: RequestHandler;
    update?: RequestHandler;
    delete?: RequestHandler;
  },
  validation?: {
    create?: RequestHandler;
    update?: RequestHandler;
  }
): RouteHandler[] {
  const routes: RouteHandler[] = [];

  if (handlers.list) {
    routes.push({
      method: 'get',
      path: '/',
      description: `List all ${resourceName}`,
      handlers: [handlers.list]
    });
  }

  if (handlers.create) {
    routes.push({
      method: 'post',
      path: '/',
      description: `Create new ${resourceName}`,
      validation: validation?.create,
      handlers: [handlers.create]
    });
  }

  if (handlers.get) {
    routes.push({
      method: 'get',
      path: '/:id',
      description: `Get ${resourceName} by ID`,
      handlers: [handlers.get]
    });
  }

  if (handlers.update) {
    routes.push({
      method: 'put',
      path: '/:id',
      description: `Update ${resourceName}`,
      validation: validation?.update,
      handlers: [handlers.update]
    });
  }

  if (handlers.delete) {
    routes.push({
      method: 'delete',
      path: '/:id',
      description: `Delete ${resourceName}`,
      handlers: [handlers.delete]
    });
  }

  return routes;
}

/**
 * Helper to validate required fields
 */
export function validateRequired(fields: string[]): RequestHandler {
  return (req, res, next) => {
    const missing = fields.filter(field => !req.body[field]);
    
    if (missing.length > 0) {
      throw new AppError(
        `Missing required fields: ${missing.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }
    
    next();
  };
}

/**
 * Helper to validate request params
 */
export function validateParams(params: Record<string, (value: any) => boolean>): RequestHandler {
  return (req, res, next) => {
    for (const [param, validator] of Object.entries(params)) {
      const value = req.params[param] || req.query[param] || req.body[param];
      
      if (!validator(value)) {
        throw new AppError(
          `Invalid parameter: ${param}`,
          400,
          'VALIDATION_ERROR'
        );
      }
    }
    
    next();
  };
}