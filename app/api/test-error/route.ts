import { NextRequest } from 'next/server';
import { handleApiError, AppError } from '@/lib/error-handler';
import * as Sentry from '@sentry/nextjs';

export async function GET(request: NextRequest) {
  const errorType = request.nextUrl.searchParams.get('type');
  
  try {
    switch (errorType) {
      case 'operational':
        throw new AppError('This is a test operational error', 400);
        
      case 'database':
        throw new Error('Database connection failed: ECONNREFUSED');
        
      case 'unhandled':
        // Force a runtime type error intentionally
        const obj: { someMethod: () => Response } | null = null;
        return obj!.someMethod();
        
      case 'sentry':
        // Direct Sentry test
        Sentry.captureMessage('Test message from API', 'info');
        return Response.json({ message: 'Test event sent to Sentry' });
        
      default:
        return Response.json({ 
          message: 'Error monitoring is active',
          types: ['operational', 'database', 'unhandled', 'sentry']
        });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
