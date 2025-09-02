/**
 * Warning banner primitive - warehouse safety colors
 * Single responsibility: Display warnings with consistent styling and accessibility
 */

import React from 'react';

interface WarningBannerProps {
  title: string;
  children: React.ReactNode;
  severity?: 'warning' | 'error' | 'info';
  onDismiss?: () => void;
}

const severityConfig = {
  error: {
    containerClass: 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20',
    iconClass: 'text-red-600 dark:text-red-400',
    titleClass: 'text-red-800 dark:text-red-300',
    contentClass: 'text-red-700 dark:text-red-400',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    )
  },
  warning: {
    containerClass: 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20',
    iconClass: 'text-amber-600 dark:text-amber-400',
    titleClass: 'text-amber-800 dark:text-amber-300',
    contentClass: 'text-amber-700 dark:text-amber-400',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    )
  },
  info: {
    containerClass: 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20',
    iconClass: 'text-blue-600 dark:text-blue-400',
    titleClass: 'text-blue-800 dark:text-blue-300',
    contentClass: 'text-blue-700 dark:text-blue-400',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
} as const;

export default function WarningBanner({ 
  title, 
  children, 
  severity = 'warning',
  onDismiss 
}: WarningBannerProps) {
  const config = severityConfig[severity];
  
  return (
    <div className={`rounded-lg border-2 p-4 ${config.containerClass} animate-fadeIn`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <div className={config.iconClass}>
            {config.icon}
          </div>
        </div>
        <div className="ml-3 flex-1">
          <div className="flex justify-between items-start">
            <h3 className={`text-sm font-medium ${config.titleClass}`}>
              {title}
            </h3>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className={`ml-2 p-1 rounded hover:bg-black/10 ${config.iconClass}`}
                aria-label="Dismiss warning"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className={`mt-2 text-sm ${config.contentClass}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}