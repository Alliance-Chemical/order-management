'use client';

import { ReactNode } from 'react';
import { ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

interface HazmatCalloutProps {
  level: 'info' | 'warning' | 'danger';
  unNumber?: string;
  packingGroup?: string;
  properShippingName?: string;
  hazardClass?: string;
  children: ReactNode;
  className?: string;
}

export default function HazmatCallout({
  level,
  unNumber,
  packingGroup,
  properShippingName,
  hazardClass,
  children,
  className = ''
}: HazmatCalloutProps) {
  // Level-based styling
  const levelStyles = {
    info: {
      bg: 'bg-warehouse-info-light',
      border: 'border-warehouse-info',
      text: 'text-warehouse-info',
      icon: InformationCircleIcon,
      label: 'INFORMATION'
    },
    warning: {
      bg: 'bg-warehouse-caution-light',
      border: 'border-warehouse-caution',
      text: 'text-warehouse-caution',
      icon: ExclamationTriangleIcon,
      label: 'CAUTION'
    },
    danger: {
      bg: 'bg-warehouse-stop-light',
      border: 'border-warehouse-stop',
      text: 'text-warehouse-stop',
      icon: XCircleIcon,
      label: 'DANGER'
    }
  };
  
  const style = levelStyles[level];
  const Icon = style.icon;
  
  return (
    <div 
      className={`
        ${style.bg} border-4 ${style.border} rounded-warehouse-lg
        p-6 shadow-warehouse-lg relative overflow-hidden
        ${className}
      `}
      role="alert"
      aria-live={level === 'danger' ? 'assertive' : 'polite'}
    >
      {/* Hazmat Diamond Icon */}
      <div className="flex gap-6 items-start">
        <div className="flex-shrink-0">
          <div className={`
            w-16 h-16 ${style.text} 
            transform rotate-45 border-4 ${style.border}
            flex items-center justify-center bg-white
          `}>
            <Icon className="h-10 w-10 transform -rotate-45" />
          </div>
        </div>
        
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <span className={`
              text-warehouse-xl font-black uppercase ${style.text}
            `}>
              {style.label}
            </span>
            {level === 'danger' && (
              <span className="animate-pulse-strong">
                <span className="relative flex h-4 w-4">
                  <span className={`
                    animate-ping absolute inline-flex h-full w-full 
                    rounded-full ${style.bg} opacity-75
                  `}></span>
                  <span className={`
                    relative inline-flex rounded-full h-4 w-4 ${style.bg}
                  `}></span>
                </span>
              </span>
            )}
          </div>
          
          {/* Hazmat Details Grid */}
          {(unNumber || packingGroup || properShippingName || hazardClass) && (
            <div className="grid grid-cols-2 gap-4 mb-4 bg-white bg-opacity-50 rounded-warehouse p-4">
              {unNumber && (
                <div>
                  <span className="text-warehouse-sm font-bold text-warehouse-text-secondary">
                    UN NUMBER:
                  </span>
                  <span className="text-warehouse-lg font-black ml-2">
                    {unNumber}
                  </span>
                </div>
              )}
              {hazardClass && (
                <div>
                  <span className="text-warehouse-sm font-bold text-warehouse-text-secondary">
                    HAZARD CLASS:
                  </span>
                  <span className="text-warehouse-lg font-black ml-2">
                    {hazardClass}
                  </span>
                </div>
              )}
              {packingGroup && (
                <div>
                  <span className="text-warehouse-sm font-bold text-warehouse-text-secondary">
                    PACKING GROUP:
                  </span>
                  <span className="text-warehouse-lg font-black ml-2">
                    {packingGroup}
                  </span>
                </div>
              )}
              {properShippingName && (
                <div className="col-span-2">
                  <span className="text-warehouse-sm font-bold text-warehouse-text-secondary">
                    PROPER SHIPPING NAME:
                  </span>
                  <div className="text-warehouse-lg font-bold mt-1">
                    {properShippingName}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Content */}
          <div className="text-warehouse-base text-warehouse-text-primary">
            {children}
          </div>
        </div>
      </div>
      
      {/* Corner Badge for Level */}
      <div className={`
        absolute top-0 right-0 
        ${style.bg} ${style.text}
        px-3 py-1 rounded-bl-warehouse font-black text-warehouse-sm
        border-l-4 border-b-4 ${style.border}
      `}>
        {level.toUpperCase()}
      </div>
    </div>
  );
}