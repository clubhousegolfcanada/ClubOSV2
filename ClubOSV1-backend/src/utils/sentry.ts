import * as Sentry from '@sentry/node';
import { logger } from './logger';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Application } from 'express';

export function initSentry() {
  const environment = process.env.NODE_ENV || 'development';
  const dsn = process.env.SENTRY_DSN;

  if (!dsn && environment === 'production') {
    logger.warn('⚠️  Sentry DSN not configured for production environment');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    integrations: [
      nodeProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    // Profiling
    profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
    
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly configured
      if (environment === 'development' && !dsn) {
        return null;
      }
      
      // Filter out sensitive data
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      if (event.request?.headers?.authorization) {
        event.request.headers.authorization = '[REDACTED]';
      }
      
      return event;
    },
    
    // Ignore common errors
    ignoreErrors: [
      'Non-Error promise rejection captured',
      'Request aborted',
      'Request timeout',
    ],
  });

  logger.debug(`✅ Sentry initialized for ${environment} environment`);
}

// Setup Sentry for Express app
export function setupSentryErrorHandler(app: Application) {
  Sentry.setupExpressErrorHandler(app);
}

// Placeholder middleware for request handling (Sentry v8 handles this differently)
export const sentryRequestHandler = (req: any, res: any, next: any) => {
  // In Sentry v8+, request handling is done automatically
  next();
};

// Placeholder middleware for tracing (Sentry v8 handles this differently)
export const sentryTracingHandler = (req: any, res: any, next: any) => {
  // In Sentry v8+, tracing is handled automatically with the integration
  next();
};

// Error handler middleware - this will be called later with the app instance
export const sentryErrorHandler = (req: any, res: any, next: any) => {
  // This is a placeholder - actual error handling is set up via setupSentryErrorHandler
  next();
};