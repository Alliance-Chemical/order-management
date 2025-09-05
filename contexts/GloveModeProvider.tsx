'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';

interface GloveModeContextType {
  enabled: boolean;
  toggle: () => void;
  touchSize: number;
  setEnabled: (enabled: boolean) => void;
}

const GloveModeContext = createContext<GloveModeContextType>({
  enabled: false,
  toggle: () => {},
  touchSize: 80,
  setEnabled: () => {}
});

export function GloveModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    // Load preference from localStorage
    const saved = localStorage.getItem('gloveMode');
    if (saved === 'true') {
      setEnabled(true);
    }
    
    // Auto-detect based on touch characteristics
    const detectGloveTouch = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      
      const touch = e.touches[0] as any;
      const radiusX = touch.radiusX || touch.webkitRadiusX || 0;
      const radiusY = touch.radiusY || touch.webkitRadiusY || 0;
      
      // Large touch area suggests gloves
      if (radiusX > 20 || radiusY > 20) {
        setEnabled(true);
        warehouseFeedback.success();
      }
    };
    
    // Listen for first touch to auto-detect
    window.addEventListener('touchstart', detectGloveTouch, { once: true });
    
    return () => {
      window.removeEventListener('touchstart', detectGloveTouch);
    };
  }, []);
  
  useEffect(() => {
    if (!mounted) return;
    
    // Update CSS variable for dynamic sizing
    const size = enabled ? 120 : 80;
    document.documentElement.style.setProperty('--touch-size', `${size}px`);
    document.documentElement.style.setProperty('--touch-size-sm', `${size * 0.75}px`);
    document.documentElement.style.setProperty('--touch-size-lg', `${size * 1.25}px`);
    document.documentElement.style.setProperty('--touch-size-xl', `${size * 1.5}px`);
    
    // Add/remove body class for cascade styles
    if (enabled) {
      document.body.classList.add('glove-mode');
      document.documentElement.setAttribute('data-glove-mode', 'true');
    } else {
      document.body.classList.remove('glove-mode');
      document.documentElement.removeAttribute('data-glove-mode');
    }
    
    // Persist preference
    localStorage.setItem('gloveMode', String(enabled));
  }, [enabled, mounted]);
  
  const toggle = () => {
    const newState = !enabled;
    setEnabled(newState);
    
    // Provide feedback
    if (newState) {
      warehouseFeedback.success();
    } else {
      warehouseFeedback.buttonPress();
    }
  };
  
  if (!mounted) {
    // Return default values during SSR
    return (
      <GloveModeContext.Provider 
        value={{
          enabled: false,
          toggle: () => {},
          touchSize: 80,
          setEnabled: () => {}
        }}
      >
        {children}
      </GloveModeContext.Provider>
    );
  }
  
  return (
    <GloveModeContext.Provider 
      value={{
        enabled,
        toggle,
        touchSize: enabled ? 120 : 80,
        setEnabled
      }}
    >
      {children}
    </GloveModeContext.Provider>
  );
}

export const useGloveMode = () => {
  const context = useContext(GloveModeContext);
  if (!context) {
    throw new Error('useGloveMode must be used within a GloveModeProvider');
  }
  return context;
};

// Glove Mode Toggle Component
export function GloveModeToggle({ 
  position = 'bottom-right' 
}: { 
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left' 
}) {
  const { enabled, toggle } = useGloveMode();
  
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'bottom-right': 'bottom-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-left': 'bottom-4 left-4'
  };
  
  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      <button
        onClick={toggle}
        className={`
          relative w-24 h-12 rounded-full transition-all duration-200
          ${enabled 
            ? 'bg-warehouse-go shadow-warehouse-lg' 
            : 'bg-gray-400 shadow-warehouse'
          }
          border-4 border-warehouse-border-heavy
        `}
        aria-label={`Glove mode ${enabled ? 'enabled' : 'disabled'}`}
      >
        {/* Switch Handle */}
        <div 
          className={`
            absolute top-0 h-10 w-10 bg-white rounded-full
            shadow-warehouse transition-transform duration-200
            flex items-center justify-center
            ${enabled ? 'translate-x-12' : 'translate-x-0'}
          `}
        >
          <svg 
            className={`w-6 h-6 ${enabled ? 'text-warehouse-go' : 'text-gray-400'}`}
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
          </svg>
        </div>
        
        {/* Label */}
        <div className={`
          absolute -bottom-6 left-1/2 transform -translate-x-1/2
          text-warehouse-xs font-bold uppercase whitespace-nowrap
          ${enabled ? 'text-warehouse-go' : 'text-gray-500'}
        `}>
          {enabled ? 'GLOVE MODE' : 'NORMAL'}
        </div>
      </button>
    </div>
  );
}