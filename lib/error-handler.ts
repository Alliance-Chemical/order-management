import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

export interface ErrorResponse {
  error: string;
  message?: string;
  details?: unknown;
  requestId?: string;
}

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  
  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export function handleApiError(error: unknown): NextResponse<ErrorResponse> {
  // Generate request ID for tracking
  const requestId = crypto.randomUUID();
  
  // Log to Sentry
  Sentry.captureException(error, {
    tags: {
      requestId,
      type: 'api_error',
    },
  });
  
  // Handle known errors
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        requestId,
      },
      { status: error.statusCode }
    );
  }
  
  // Handle database errors
  if (error instanceof Error) {
    // Don't expose database details in production
    const message = process.env.NODE_ENV === 'production' 
      ? 'An error occurred processing your request'
      : error.message;
      
    return NextResponse.json(
      {
        error: message,
        requestId,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
  
  // Unknown error
  return NextResponse.json(
    {
      error: 'An unexpected error occurred',
      requestId,
    },
    { status: 500 }
  );
}

// Wrap API route handlers with error handling
export function withErrorHandler<T extends unknown[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | NextResponse<ErrorResponse>> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

// ============================================================================
// CLIENT-SIDE ERROR HANDLING UTILITIES
// ============================================================================

export class NetworkError extends AppError {
  constructor(message: string = 'Network connection failed') {
    super(message, 0, true);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: unknown) {
    super(message, 400, true);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, true);
    this.name = 'NotFoundError';
  }
}

/**
 * Parse fetch response and throw appropriate error
 */
export async function handleFetchError(response: Response): Promise<never> {
  let errorData: ErrorResponse = {
    error: response.statusText,
  };

  try {
    errorData = await response.json();
  } catch {
    // Response body is not JSON
  }

  const message = errorData.message || errorData.error;

  if (response.status === 400) {
    throw new ValidationError(message, errorData.details);
  }

  if (response.status === 404) {
    throw new NotFoundError(message);
  }

  throw new AppError(message, response.status);
}

/**
 * Wrap async operations with consistent error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  options: {
    onError?: (error: AppError) => void;
    fallback?: T;
    context?: string;
  } = {}
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    const appError = error instanceof AppError ? error : new AppError(String(error));

    // Log error
    console.error(`[Error${options.context ? ` - ${options.context}` : ''}]:`, appError);

    // Log to Sentry
    if (typeof window !== 'undefined') {
      Sentry.captureException(appError, {
        contexts: {
          error: {
            context: options.context,
          },
        },
      });
    }

    // Call custom error handler
    options.onError?.(appError);

    // Return fallback if provided
    if (options.fallback !== undefined) {
      return options.fallback;
    }

    // Re-throw for caller to handle
    throw appError;
  }
}

/**
 * Get user-friendly error message
 */
export function getUserErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('network') || message.includes('timeout') || message.includes('fetch');
  }
  return false;
}

/**
 * Create a safe async handler for React event handlers
 */
export function createAsyncHandler<Args extends unknown[]>(
  handler: (...args: Args) => Promise<void>,
  options: {
    onError?: (error: AppError) => void;
    context?: string;
  } = {}
) {
  return (...args: Args) => {
    withErrorHandling(() => handler(...args), {
      onError: options.onError,
      context: options.context,
    }).catch((error) => {
      console.error('Unhandled async error:', error);
    });
  };
}
