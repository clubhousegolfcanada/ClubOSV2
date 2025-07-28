import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

export function initSentry() {
  const environment = process.env.NODE_ENV || 'development';
  const dsn = process.env.SENTRY_DSN;

  if (!dsn && environment === 'production') {
    console.warn('⚠️  Sentry DSN not configured for production environment');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    integrations: [
      new ProfilingIntegration(),
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

  console.log(`✅ Sentry initialized for ${environment} environment`);
}

// Error handler middleware
export const sentryErrorHandler = Sentry.Handlers.errorHandler();

// Request handler middleware (should be one of the first middlewares)
export const sentryRequestHandler = Sentry.Handlers.requestHandler();

// Tracing handler middleware
export const sentryTracingHandler = Sentry.Handlers.tracingHandler();