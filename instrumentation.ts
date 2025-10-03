// Instrumentation hook for Next.js 15
// This file runs at the edge, in Node.js, and in the browser

export async function register() {
  // Only initialize Sentry if we have a DSN configured
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
  
  // Optionally ensure DB schema at cold start (safe, idempotent)
  try {
    if (process.env.AUTO_ENSURE_DB === '1' || process.env.AUTO_ENSURE_DB === 'true') {
      const { ensureCoreFreightSchema } = await import('@/lib/db/ensure-schema');
      await ensureCoreFreightSchema();
    }
  } catch (e) {
    // Don’t block boot if DB isn’t reachable yet
    if (process.env.NODE_ENV !== 'production') {
      console.warn('AUTO_ENSURE_DB failed (non-fatal):', e);
    }
  }

  if (!sentryDsn) {
    return; // Skip Sentry initialization if no DSN is provided
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { init } = await import('@sentry/nextjs');
    
    init({
      dsn: sentryDsn,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      environment: process.env.NODE_ENV,
      debug: false,
      
      // Remove Prisma integration since we use Drizzle, not Prisma
      integrations: (defaults) => defaults.filter((integration) => integration.name !== 'Prisma'),
      
      // Filter out certain errors
      beforeSend(event, hint) {
        // Filter database connection errors in development
        if (process.env.NODE_ENV !== 'production') {
          const originalError = hint.originalException;
          const message =
            typeof originalError === 'object' &&
            originalError !== null &&
            'message' in originalError &&
            typeof (originalError as { message?: unknown }).message === 'string'
              ? (originalError as { message: string }).message
              : null;

          if (message && (message.includes('ECONNREFUSED') || message.includes('password authentication failed'))) {
            return null;
          }
        }

        return event;
      },
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const { init } = await import('@sentry/nextjs');
    
    init({
      dsn: sentryDsn,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      environment: process.env.NODE_ENV,
      debug: false,
      
      // Remove Prisma integration since we use Drizzle, not Prisma
      integrations: (defaults) => defaults.filter((integration) => integration.name !== 'Prisma'),
    });
  }
}

export async function onRequestError(
  error: { digest?: string } & Error,
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string };
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
  }
) {
  // Log errors to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Request error:', {
      error: error.message,
      digest: error.digest,
      path: request.path,
      method: request.method,
      context,
    });
  }
}
