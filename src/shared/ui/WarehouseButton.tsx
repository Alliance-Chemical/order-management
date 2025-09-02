/**
 * Warehouse button primitive - touch-friendly with haptic feedback
 * Single responsibility: Warehouse-compliant button with accessibility
 */

import React from 'react';

export type WarehouseButtonVariant = 'go' | 'stop' | 'caution' | 'info' | 'neutral';
export type WarehouseButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface WarehouseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: WarehouseButtonVariant;
  size?: WarehouseButtonSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
  hapticFeedback?: boolean;
}

const variantClasses = {
  go: 'warehouse-btn-go',
  stop: 'warehouse-btn-stop', 
  caution: 'warehouse-btn-caution',
  info: 'warehouse-btn-info',
  neutral: 'warehouse-btn-neutral'
} as const;

const sizeClasses = {
  sm: 'min-h-[60px] px-4 text-base',
  md: 'min-h-[80px] px-6 text-lg', // Default warehouse minimum
  lg: 'min-h-[100px] px-8 text-xl',
  xl: 'min-h-[120px] px-10 text-2xl' // Glove mode
} as const;

export default function WarehouseButton({
  variant = 'neutral',
  size = 'md',
  icon,
  children,
  hapticFeedback = true,
  className = '',
  onTouchStart,
  onClick,
  ...props
}: WarehouseButtonProps) {
  
  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(50); // Brief haptic feedback
    }
    onTouchStart?.(e);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Web Audio API click sound could be added here
    onClick?.(e);
  };

  return (
    <button
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        flex items-center justify-center gap-3
        font-black uppercase tracking-wide
        transform active:scale-95 transition-transform
        focus:ring-4 focus:ring-offset-2
        ${className}
      `}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}