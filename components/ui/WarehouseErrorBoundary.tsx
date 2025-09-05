'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: 'page' | 'section' | 'component';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

export class WarehouseErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('WarehouseErrorBoundary caught:', error, errorInfo);
    }
    
    // Haptic feedback for error
    warehouseFeedback.error();
    
    // Update state with error details
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;
    
    // Reset on prop changes if requested
    if (hasError && prevProps.resetKeys !== resetKeys && resetOnPropsChange) {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = () => {
    warehouseFeedback.buttonPress();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    const { hasError, error, errorCount } = this.state;
    const { fallback, children, level = 'component' } = this.props;

    if (hasError) {
      // Custom fallback if provided
      if (fallback) {
        return <>{fallback}</>;
      }

      // Default fallback UI based on error level
      return (
        <div className={`
          ${level === 'page' ? 'min-h-screen' : level === 'section' ? 'min-h-[400px]' : 'min-h-[200px]'}
          flex items-center justify-center p-6
        `}>
          <div className="warehouse-card max-w-2xl w-full">
            {/* Error Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="warehouse-status-light-stop w-12 h-12" />
              <div>
                <h2 className="text-warehouse-2xl font-black text-warehouse-stop">
                  {level === 'page' ? 'PAGE ERROR' : level === 'section' ? 'SECTION ERROR' : 'COMPONENT ERROR'}
                </h2>
                {errorCount > 1 && (
                  <p className="text-warehouse-base text-warehouse-text-secondary">
                    Error occurred {errorCount} times
                  </p>
                )}
              </div>
            </div>

            {/* Error Message */}
            <div className="bg-warehouse-stop-light border-4 border-warehouse-stop rounded-warehouse p-4 mb-6">
              <p className="text-warehouse-lg font-bold text-warehouse-text-primary mb-2">
                {error?.message || 'An unexpected error occurred'}
              </p>
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4">
                  <summary className="text-warehouse-base font-bold cursor-pointer text-warehouse-stop">
                    TECHNICAL DETAILS
                  </summary>
                  <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto">
                    {error?.stack}
                  </pre>
                </details>
              )}
            </div>

            {/* Recovery Actions */}
            <div className="flex gap-4">
              <button
                onClick={this.resetErrorBoundary}
                className="warehouse-btn-caution min-h-touch-base"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-warehouse-xl">TRY AGAIN</span>
              </button>
              
              {level === 'page' && (
                <button
                  onClick={() => window.location.href = '/'}
                  className="warehouse-btn-info min-h-touch-base"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="text-warehouse-xl">GO HOME</span>
                </button>
              )}
            </div>

            {/* Help Text */}
            <div className="mt-6 p-4 bg-warehouse-bg-light rounded-warehouse">
              <p className="text-warehouse-base text-warehouse-text-secondary">
                {level === 'page' 
                  ? 'The page encountered an error. Try refreshing or return to dashboard.'
                  : level === 'section'
                  ? 'This section failed to load. Try again or skip this step.'
                  : 'This component failed. You can continue with other tasks.'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

// Convenience wrapper with common settings
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <WarehouseErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </WarehouseErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}