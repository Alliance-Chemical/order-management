'use client';

import { memo } from 'react';

import { cn } from '@/lib/utils';

interface StatusLightProps {
  status: 'go' | 'stop' | 'caution' | 'off';
  pulse?: boolean;
  size?: 'sm' | 'base' | 'lg' | 'xl';
  label?: string;
  className?: string;
}

const StatusLight = memo(function StatusLight({ 
  status, 
  pulse = true,
  size = 'base',
  label,
  className 
}: StatusLightProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    base: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };
  
  const statusClasses = {
    go: 'bg-warehouse-go text-warehouse-go',
    stop: 'bg-warehouse-stop text-warehouse-stop',
    caution: 'bg-warehouse-caution text-warehouse-caution',
    off: 'bg-gray-400 text-gray-400'
  };
  
  const pulseAnimation = {
    go: 'animate-pulse-strong',
    stop: 'animate-pulse-strong',
    caution: 'animate-pulse',
    off: ''
  };
  
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <div
        className={cn(
          'rounded-full border-2 border-gray-700 relative',
          sizeClasses[size],
          statusClasses[status],
          pulse && status !== 'off' && pulseAnimation[status],
          'shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]'
        )}
        style={{
          boxShadow: status !== 'off' 
            ? `inset 0 2px 4px rgba(0,0,0,0.3), 0 0 ${size === 'xl' ? '20px' : '10px'} currentColor`
            : 'inset 0 2px 4px rgba(0,0,0,0.3)'
        }}
        role="status"
        aria-label={`Status: ${status}${label ? ` - ${label}` : ''}`}
      >
        {/* Inner reflection for realism */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white to-transparent opacity-30" />
      </div>
      
      {label && (
        <span className={cn(
          'font-black uppercase',
          size === 'xl' ? 'text-warehouse-lg' : 
          size === 'lg' ? 'text-warehouse-base' : 
          'text-warehouse-sm',
          status === 'off' ? 'text-gray-500' : 'text-warehouse-text-primary'
        )}>
          {label}
        </span>
      )}
    </div>
  );
});

export default StatusLight;

// Status Light Group Component
interface StatusLightGroupProps {
  lights: Array<{
    status: 'go' | 'stop' | 'caution' | 'off';
    label: string;
  }>;
  size?: 'sm' | 'base' | 'lg' | 'xl';
  vertical?: boolean;
  className?: string;
}

export const StatusLightGroup = memo(function StatusLightGroup({ 
  lights, 
  size = 'base',
  vertical = false,
  className 
}: StatusLightGroupProps) {
  return (
    <div className={cn(
      'flex gap-4',
      vertical ? 'flex-col' : 'flex-row items-center',
      className
    )}>
      {lights.map((light, index) => (
        <StatusLight
          key={`${light.label}-${index}`}
          status={light.status}
          label={light.label}
          size={size}
          pulse
        />
      ))}
    </div>
  );
});