import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Environment
  environment: process.env.NODE_ENV,
  
  // Debugging
  debug: false,
  
  // Filter out certain errors
  beforeSend(event, hint) {
    // Filter database connection errors in development
    if (process.env.NODE_ENV !== 'production') {
      const error = hint.originalException;
      if (error?.message?.includes('ECONNREFUSED') || 
          error?.message?.includes('password authentication failed')) {
        return null;
      }
    }
    
    return event;
  },
});