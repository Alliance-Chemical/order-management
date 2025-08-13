import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Session Replay
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
  
  // Release tracking
  environment: process.env.NODE_ENV,
  
  // Debugging
  debug: false,
  
  // Integrations
  integrations: [
    Sentry.replayIntegration({
      // Mask sensitive content
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  
  // Filter out certain errors
  beforeSend(event, hint) {
    // Filter out non-critical errors
    if (event.exception) {
      const error = hint.originalException;
      
      // Don't log auth redirects
      if (error?.message?.includes('NEXT_REDIRECT')) {
        return null;
      }
      
      // Don't log network errors in development
      if (process.env.NODE_ENV !== 'production' && error?.message?.includes('fetch')) {
        return null;
      }
    }
    
    return event;
  },
});