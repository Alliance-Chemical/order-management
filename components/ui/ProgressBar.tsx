'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'base' | 'lg';
  animated?: boolean;
  className?: string;
}

const ProgressBar = memo(function ProgressBar({
  value,
  label,
  showPercentage = false,
  variant = 'default',
  size = 'base',
  animated = true,
  className
}: ProgressBarProps) {
  // Clamp value between 0 and 100
  const progress = useMemo(() => Math.min(Math.max(value, 0), 100), [value]);
  
  const sizeClasses = {
    sm: 'h-6',
    base: 'h-8',
    lg: 'h-12'
  };
  
  const variantClasses = {
    default: 'bg-warehouse-info',
    success: 'bg-warehouse-go',
    warning: 'bg-warehouse-caution',
    danger: 'bg-warehouse-stop'
  };
  
  const variantGradients = {
    default: 'from-[#0065FF] via-[#0052CC] to-[#0065FF]',
    success: 'from-[#00A34A] via-[#00873E] to-[#00A34A]',
    warning: 'from-[#FFB84D] via-[#F5A623] to-[#FFB84D]',
    danger: 'from-[#E60000] via-[#CC0000] to-[#E60000]'
  };
  
  return (
    <div className={cn('w-full', className)}>
      {/* Label and percentage */}
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span className="text-warehouse-base font-bold text-warehouse-text-primary">
              {label}
            </span>
          )}
          {showPercentage && (
            <span className="text-warehouse-lg font-black text-warehouse-text-primary">
              {progress}%
            </span>
          )}
        </div>
      )}
      
      {/* Progress container */}
      <div 
        className={cn(
          'bg-gray-300 rounded-full overflow-hidden',
          'border-2 border-warehouse-border-heavy',
          'shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]',
          sizeClasses[size]
        )}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || `Progress: ${progress}%`}
      >
        {/* Progress bar */}
        <div 
          className={cn(
            'h-full transition-all duration-300 relative',
            variantClasses[variant]
          )}
          style={{ 
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${variantGradients[variant].split(' ').join(', ')})`
          }}
        >
          {/* Animated stripes overlay */}
          {animated && progress > 0 && progress < 100 && (
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 10px,
                  rgba(255,255,255,0.1) 10px,
                  rgba(255,255,255,0.1) 20px
                )`,
                animation: 'progress-stripes 1s linear infinite'
              }}
            />
          )}
          
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white to-transparent opacity-20" />
        </div>
      </div>
    </div>
  );
});

export default ProgressBar;

// Step Progress Component for workflows
interface StepProgressProps {
  steps: Array<{
    label: string;
    status: 'pending' | 'current' | 'completed' | 'error';
  }>;
  className?: string;
}

export function StepProgress({ steps, className }: StepProgressProps) {
  const currentIndex = steps.findIndex(s => s.status === 'current');
  const completedCount = steps.filter(s => s.status === 'completed').length;
  const progress = (completedCount / steps.length) * 100;
  
  return (
    <div className={cn('w-full', className)}>
      {/* Progress bar */}
      <ProgressBar
        value={progress}
        variant={steps.some(s => s.status === 'error') ? 'danger' : 'success'}
        animated={currentIndex !== -1}
        size="sm"
      />
      
      {/* Step indicators */}
      <div className="flex justify-between mt-4">
        {steps.map((step, index) => (
          <div 
            key={`${step.label}-${index}`}
            className="flex flex-col items-center flex-1"
          >
            {/* Step circle */}
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center',
              'border-4 font-black text-warehouse-lg',
              step.status === 'completed' && 'bg-warehouse-go text-white border-warehouse-go',
              step.status === 'current' && 'bg-warehouse-caution text-white border-warehouse-caution animate-pulse-strong',
              step.status === 'error' && 'bg-warehouse-stop text-white border-warehouse-stop animate-error-shake',
              step.status === 'pending' && 'bg-gray-200 text-gray-500 border-gray-400'
            )}>
              {step.status === 'completed' ? '✓' : 
               step.status === 'error' ? '✗' : 
               index + 1}
            </div>
            
            {/* Step label */}
            <span className={cn(
              'text-warehouse-xs font-bold mt-2 text-center',
              step.status === 'current' ? 'text-warehouse-caution' :
              step.status === 'completed' ? 'text-warehouse-go' :
              step.status === 'error' ? 'text-warehouse-stop' :
              'text-gray-500'
            )}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}