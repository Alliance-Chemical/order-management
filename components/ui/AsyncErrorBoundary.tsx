'use client';

import React from 'react';
import { Button } from './button';
import { Alert } from './alert';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';

interface AsyncErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<AsyncErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: unknown[];
}

export interface AsyncErrorFallbackProps {
  error: Error;
  reset: () => void;
  retry?: () => Promise<void>;
}

interface AsyncErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

/**
 * Error Boundary specifically designed for async operations
 * Features:
 * - Automatic retry mechanism
 * - Custom fallback UI
 * - Error telemetry integration
 * - Warehouse haptic feedback
 */
export class AsyncErrorBoundary extends React.Component<
  AsyncErrorBoundaryProps,
  AsyncErrorBoundaryState
> {
  constructor(props: AsyncErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<AsyncErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Haptic feedback
    if (typeof window !== 'undefined') {
      warehouseFeedback.error();
    }

    // Custom error handler
    this.props.onError?.(error, errorInfo);

    // Log to monitoring service
    if (typeof window !== 'undefined') {
      type WindowWithSentry = Window & {
        Sentry?: {
          captureException: (err: unknown, context?: unknown) => void;
        };
      };

      const windowWithSentry = window as WindowWithSentry;
      windowWithSentry.Sentry?.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
          async: {
            retryCount: this.state.retryCount,
          },
        },
      });
    }

    console.error('AsyncErrorBoundary caught error:', error, errorInfo);
  }

  componentDidUpdate(
    prevProps: AsyncErrorBoundaryProps,
    prevState: AsyncErrorBoundaryState
  ) {
    // Reset error state when resetKeys change
    if (
      this.props.resetKeys &&
      prevProps.resetKeys &&
      this.props.resetKeys.some((key, index) => key !== prevProps.resetKeys?.[index])
    ) {
      this.reset();
    }

    // Auto-retry once for transient errors
    if (
      this.state.hasError &&
      !prevState.hasError &&
      this.state.retryCount === 0 &&
      this.isTransientError(this.state.error)
    ) {
      setTimeout(() => {
        this.retry();
      }, 1000);
    }
  }

  isTransientError(error: Error | null): boolean {
    if (!error) return false;
    const transientMessages = ['network', 'timeout', 'aborted', 'failed to fetch'];
    return transientMessages.some((msg) =>
      error.message.toLowerCase().includes(msg)
    );
  }

  reset = () => {
    warehouseFeedback.buttonPress();
    this.setState({ hasError: false, error: null, retryCount: 0 });
  };

  retry = async () => {
    warehouseFeedback.buttonPress();
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultAsyncErrorFallback;
      return (
        <FallbackComponent
          error={this.state.error}
          reset={this.reset}
          retry={this.retry}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default fallback UI for async errors
 */
function DefaultAsyncErrorFallback({
  error,
  reset,
  retry,
}: AsyncErrorFallbackProps) {
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = async () => {
    if (!retry) {
      reset();
      return;
    }

    setIsRetrying(true);
    try {
      await retry();
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="p-4 rounded-lg bg-red-50 border-2 border-red-200 dark:bg-red-900/20 dark:border-red-800">
      <Alert variant="destructive" className="mb-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-800 dark:text-red-200">
              Operation Failed
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {error.message || 'An unexpected error occurred'}
            </p>
          </div>
        </div>
      </Alert>

      <div className="flex gap-2">
        <Button
          onClick={handleRetry}
          variant="destructive"
          size="sm"
          disabled={isRetrying}
          aria-label="Retry operation"
        >
          {isRetrying ? (
            <>
              <svg
                className="w-4 h-4 mr-2 animate-spin"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Retrying...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Try Again
            </>
          )}
        </Button>
        <Button onClick={reset} variant="outline" size="sm" aria-label="Reset component">
          Reset
        </Button>
      </div>

      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 p-3 bg-white dark:bg-gray-800 rounded border">
          <summary className="cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900">
            Error Details (Development Only)
          </summary>
          <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto max-h-40">
            {error.stack || error.message}
          </pre>
        </details>
      )}
    </div>
  );
}

export default AsyncErrorBoundary;
