/**
 * Structured Logger with Backwards Compatibility
 *
 * SAFE FEATURES:
 * - Falls back to console.log if Pino fails
 * - Can be toggled via feature flag
 * - Adds context automatically (requestId, userId, etc)
 * - Production-ready JSON format
 * - Dev-friendly pretty printing
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info({ workspaceId, orderId }, 'Workspace created');
 *   logger.error({ error, orderId }, 'Failed to create workspace');
 */

import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

// Request context storage (for correlation IDs)
export const requestContext = new AsyncLocalStorage<{
  requestId: string;
  userId?: string;
  tenantId?: string;
  route?: string;
}>();

// Feature flag check (safe default: use console.log)
function isStructuredLoggingEnabled(): boolean {
  // For now, check env variable. Later, check feature_flags table
  return process.env.ENABLE_STRUCTURED_LOGGING === 'true';
}

// Create Pino logger with safe configuration
const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Pretty print in development
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  // Add base fields
  base: {
    env: process.env.NODE_ENV,
    service: 'alliance-chemical-app',
  },
  // Serialize errors properly
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

/**
 * Safe logger that automatically includes request context
 */
class SafeLogger {
  private pino = pinoLogger;

  /**
   * Add request context to all log fields
   */
  private enrichWithContext(fields: Record<string, unknown> = {}): Record<string, unknown> {
    const context = requestContext.getStore();
    if (!context) return fields;

    return {
      ...fields,
      requestId: context.requestId,
      userId: context.userId,
      tenantId: context.tenantId,
      route: context.route,
    };
  }

  /**
   * Safe log method that falls back to console if needed
   */
  private safeLog(
    level: 'info' | 'warn' | 'error' | 'debug',
    fields: Record<string, unknown> | string,
    message?: string
  ) {
    try {
      // Check feature flag
      if (!isStructuredLoggingEnabled()) {
        // Fall back to console.log
        const msg = typeof fields === 'string' ? fields : message;
        const data = typeof fields === 'object' ? fields : {};
        console[level === 'debug' ? 'log' : level](`[${level.toUpperCase()}]`, msg, data);
        return;
      }

      // Use structured logging
      if (typeof fields === 'string') {
        this.pino[level](fields);
      } else {
        const enrichedFields = this.enrichWithContext(fields);
        this.pino[level](enrichedFields, message || '');
      }
    } catch (error) {
      // Ultimate fallback: console.log
      console.error('Logger failed, falling back to console:', error);
      console.log('[FALLBACK]', level, fields, message);
    }
  }

  info(fields: Record<string, unknown> | string, message?: string) {
    this.safeLog('info', fields, message);
  }

  warn(fields: Record<string, unknown> | string, message?: string) {
    this.safeLog('warn', fields, message);
  }

  error(fields: Record<string, unknown> | string, message?: string) {
    this.safeLog('error', fields, message);
  }

  debug(fields: Record<string, unknown> | string, message?: string) {
    this.safeLog('debug', fields, message);
  }

  /**
   * Create a child logger with pre-bound fields
   */
  child(bindings: Record<string, unknown>) {
    const childLogger = this.pino.child(bindings);
    const childSafeLogger = new SafeLogger();
    childSafeLogger.pino = childLogger;
    return childSafeLogger;
  }
}

// Export singleton logger
export const logger = new SafeLogger();

/**
 * Helper to set request context (use in middleware)
 */
export function setRequestContext(context: {
  requestId: string;
  userId?: string;
  tenantId?: string;
  route?: string;
}) {
  requestContext.enterWith(context);
}

/**
 * Helper to run code with request context
 */
export async function withRequestContext<T>(
  context: { requestId: string; userId?: string; tenantId?: string; route?: string },
  fn: () => Promise<T>
): Promise<T> {
  return requestContext.run(context, fn);
}

/**
 * Backwards-compatible console.log replacement
 * Drop-in replacement that works with or without structured logging
 */
export function log(...args: unknown[]) {
  if (args.length === 0) {
    logger.info('');
    return;
  }

  // If first arg is an object, treat as fields
  if (typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
    const [fields, ...rest] = args;
    logger.info(fields as Record<string, unknown>, rest.join(' '));
  } else {
    logger.info(args.join(' '));
  }
}

/**
 * Safe error logger with stack trace
 */
export function logError(error: Error | unknown, context?: Record<string, unknown>) {
  if (error instanceof Error) {
    logger.error(
      {
        ...context,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      },
      'Error occurred'
    );
  } else {
    logger.error({ ...context, error: String(error) }, 'Unknown error');
  }
}

/**
 * Performance timing helper
 */
export function timeOperation<T>(name: string, fn: () => T): T;
export function timeOperation<T>(name: string, fn: () => Promise<T>): Promise<T>;
export function timeOperation<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
  const start = Date.now();

  try {
    const result = fn();

    // Handle async functions
    if (result instanceof Promise) {
      return result
        .then((value) => {
          logger.info({ operation: name, duration: Date.now() - start }, 'Operation completed');
          return value;
        })
        .catch((error) => {
          logger.error(
            { operation: name, duration: Date.now() - start, error },
            'Operation failed'
          );
          throw error;
        }) as T;
    }

    // Handle sync functions
    logger.info({ operation: name, duration: Date.now() - start }, 'Operation completed');
    return result;
  } catch (error) {
    logger.error({ operation: name, duration: Date.now() - start, error }, 'Operation failed');
    throw error;
  }
}