'use client';

import React from 'react';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Provide haptic feedback for error
    if (typeof window !== 'undefined') {
      warehouseFeedback.error();
    }
    
    // Log to monitoring service if available
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack
          }
        }
      });
    }
  }

  reset = () => {
    warehouseFeedback.buttonPress();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error!} reset={this.reset} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-red-50 to-white">
      <div className="warehouse-card warehouse-error max-w-2xl w-full">
        <div className="flex flex-col items-center text-center">
          {/* Error Icon */}
          <div className="warehouse-icon-2xl text-warehouse-stop mb-6 animate-error-shake">
            <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          {/* Error Message */}
          <h1 className="warehouse-title text-warehouse-stop mb-4">
            SYSTEM ERROR
          </h1>
          
          <p className="warehouse-subtitle text-warehouse-text-secondary mb-8">
            Something went wrong. Your work is saved.
          </p>
          
          {/* Error Code Display */}
          <div className="warehouse-badge-stop mb-6">
            <span>ERROR CODE: {Date.now().toString(36).toUpperCase()}</span>
          </div>
          
          {/* Error Details (in development) */}
          {process.env.NODE_ENV === 'development' && (
            <details className="w-full mb-8 p-4 bg-red-100 rounded-warehouse text-left">
              <summary className="cursor-pointer text-warehouse-base font-bold text-red-800 hover:text-red-600">
                View Technical Details
              </summary>
              <pre className="mt-4 p-4 bg-white rounded text-warehouse-sm font-mono text-red-800 overflow-auto">
                {error.stack || error.message}
              </pre>
            </details>
          )}
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <button
              onClick={() => {
                warehouseFeedback.buttonPress();
                reset();
              }}
              className="warehouse-btn-go flex-1 min-h-touch-base"
            >
              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>TRY AGAIN</span>
            </button>
            
            <button
              onClick={() => {
                warehouseFeedback.buttonPress();
                window.location.href = '/';
              }}
              className="warehouse-btn-info flex-1 min-h-touch-base"
            >
              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" 
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>GO HOME</span>
            </button>
          </div>
          
          {/* Help Contact */}
          <div className="mt-8 p-6 bg-yellow-50 rounded-warehouse-lg border-4 border-warehouse-caution">
            <div className="warehouse-icon text-warehouse-caution mb-2">
              <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" 
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <p className="warehouse-label text-warehouse-text-primary">
              NEED HELP? CALL WAREHOUSE SUPPORT
            </p>
            <p className="text-warehouse-2xl font-black text-warehouse-caution mt-2">
              EXT. 5555
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundary;