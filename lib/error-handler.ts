import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

export interface ErrorResponse {
  error: string;
  message?: string;
  details?: any;
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
export function withErrorHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | NextResponse<ErrorResponse>> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error) as any;
    }
  };
}