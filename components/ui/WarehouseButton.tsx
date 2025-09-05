'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';
import { useGloveMode } from '@/contexts/GloveModeProvider';
import { cn } from '@/lib/utils';

export interface WarehouseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'go' | 'stop' | 'caution' | 'info' | 'neutral';
  size?: 'base' | 'large' | 'xlarge';
  loading?: boolean;
  haptic?: 'light' | 'success' | 'warning' | 'error';
  icon?: React.ReactNode;
  trackingEvent?: string;
  fullWidth?: boolean;
}

const WarehouseButton = forwardRef<HTMLButtonElement, WarehouseButtonProps>(
  ({ 
    variant = 'neutral',
    size = 'base',
    loading = false,
    disabled = false,
    haptic = 'light',
    icon,
    trackingEvent,
    fullWidth = false,
    children,
    onClick,
    className,
    ...props
  }, ref) => {
    const { touchSize } = useGloveMode();
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || loading) return;
      
      // Multimodal feedback based on haptic type
      switch (haptic) {
        case 'success':
          warehouseFeedback.success();
          break;
        case 'warning':
          warehouseFeedback.warning();
          break;
        case 'error':
          warehouseFeedback.error();
          break;
        default:
          warehouseFeedback.buttonPress();
      }
      
      // Analytics tracking
      if (trackingEvent && typeof window !== 'undefined') {
        console.log('[Analytics] Button tap:', trackingEvent, { variant, size });
      }
      
      // Call original onClick
      onClick?.(e);
    };
    
    // Dynamic size based on glove mode
    const getSizeStyle = () => {
      const multiplier = size === 'xlarge' ? 1.5 : size === 'large' ? 1.25 : 1;
      return {
        minHeight: `${touchSize * multiplier}px`,
        fontSize: size === 'xlarge' ? '2rem' : size === 'large' ? '1.5rem' : '1.25rem'
      };
    };
    
    // Variant classes (reuse existing from globals.css)
    const variantClass = `warehouse-btn-${variant}`;
    
    return (
      <button
        ref={ref}
        onClick={handleClick}
        disabled={disabled || loading}
        className={cn(
          variantClass,
          fullWidth && 'w-full',
          loading && 'opacity-50 cursor-wait',
          disabled && 'opacity-50 cursor-not-allowed',
          'transition-all duration-150',
          className
        )}
        style={getSizeStyle()}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        aria-pressed={false}
        aria-label={typeof children === 'string' ? children as string : undefined}
        data-tracking={trackingEvent}
        {...props}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-3">
            <div className="animate-spin h-8 w-8 border-4 border-current border-t-transparent rounded-full" />
            <span>LOADING...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            {icon && <span className="warehouse-icon">{icon}</span>}
            {children}
          </div>
        )}
      </button>
    );
  }
);

WarehouseButton.displayName = 'WarehouseButton';

export default WarehouseButton;

// Convenience exports for common button types
export const GoButton: typeof WarehouseButton = (props) => (
  <WarehouseButton variant="go" haptic="success" {...props} />
);

export const StopButton: typeof WarehouseButton = (props) => (
  <WarehouseButton variant="stop" haptic="error" {...props} />
);

export const CautionButton: typeof WarehouseButton = (props) => (
  <WarehouseButton variant="caution" haptic="warning" {...props} />
);

export const InfoButton: typeof WarehouseButton = (props) => (
  <WarehouseButton variant="info" {...props} />
);