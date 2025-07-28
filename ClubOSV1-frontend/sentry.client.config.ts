import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust this value in production, or use tracesSampleRate for finer control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
  
  replaysOnErrorSampleRate: 1.0,
  
  // This sets the sample rate to be 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysSessionSampleRate: 0.1,
  
  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  
  // Filter out sensitive routes
  beforeSend(event, hint) {
    // Don't send events for health checks
    if (event.request?.url?.includes('/health')) {
      return null;
    }
    
    // Remove sensitive data
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    
    return event;
  },
  
  // Ignore common errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    // Facebook errors
    'fb_xd_fragment',
    // Network errors
    'NetworkError',
    'Network request failed',
    // Safari specific
    'Non-Error promise rejection captured',
  ],
});