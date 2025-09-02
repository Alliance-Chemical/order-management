/**
 * Status badge primitive - warehouse touch-friendly
 * Single responsibility: Display status with consistent warehouse styling
 */

import React from 'react';

export type StatusType = 'pending' | 'in_progress' | 'completed' | 'error' | 'warning';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig = {
  completed: {
    className: 'warehouse-badge-go',
    defaultLabel: 'COMPLETE',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )
  },
  in_progress: {
    className: 'warehouse-badge-caution animate-pulse-strong',
    defaultLabel: 'IN PROGRESS',
    icon: (
      <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    )
  },
  error: {
    className: 'warehouse-badge-stop',
    defaultLabel: 'ERROR',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  },
  warning: {
    className: 'warehouse-badge-caution',
    defaultLabel: 'WARNING',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    )
  },
  pending: {
    className: 'warehouse-badge px-4 py-2 bg-gray-200 text-warehouse-text-primary border-gray-500',
    defaultLabel: 'WAITING',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
} as const;

export default function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizeClasses = {
    sm: 'text-sm px-2 py-1',
    md: 'text-base px-4 py-2', 
    lg: 'text-lg px-6 py-3'
  };
  
  return (
    <div className={`${config.className} ${sizeClasses[size]}`}>
      {config.icon}
      <span>{label || config.defaultLabel}</span>
    </div>
  );
}