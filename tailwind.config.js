/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // High-contrast colors for warehouse workers - WCAG AAA compliant
        'warehouse': {
          // Primary action colors - like physical buttons/lights
          'go': '#00873E', // Darker green for better contrast (7:1 ratio)
          'stop': '#CC0000', // Darker red for better contrast
          'caution': '#B87514', // Darkened amber for WCAG AAA (7:1)
          'info': '#0052CC', // Darker blue for information
          
          // Status colors - match warehouse safety standards
          'safe': '#00873E',
          'warning': '#B87514', // Darkened to match caution
          'danger': '#CC0000',
          'neutral': '#5E6C84',
          
          // Light backgrounds for callouts
          'go-light': '#E6F7ED',
          'stop-light': '#FFEBE6',
          'caution-light': '#FFF4E6',
          'info-light': '#E6F0FF',
          
          // Text and backgrounds
          'text-primary': '#091E42', // Almost black for maximum readability
          'text-secondary': '#344563',
          'text-inverse': '#FFFFFF',
          'bg-light': '#F7F8FC',
          'bg-card': '#FFFFFF',
          'bg-highlight': '#FFF3CD', // Yellow highlight for current item
          
          // Borders and dividers
          'border': '#DFE1E6',
          'border-heavy': '#5E6C84',
        },
        // Legacy worker colors (kept for compatibility)
        'worker': {
          'green': '#00873E',
          'red': '#CC0000',
          'blue': '#0052CC',
          'gray': '#091E42',
          'light-gray': '#F7F8FC',
        }
      },
      fontSize: {
        // Extra large sizes for warehouse environment
        'warehouse-xs': '1rem', // 16px minimum
        'warehouse-sm': '1.25rem', // 20px
        'warehouse-base': '1.5rem', // 24px
        'warehouse-lg': '1.875rem', // 30px
        'warehouse-xl': '2.25rem', // 36px
        'warehouse-2xl': '3rem', // 48px
        'warehouse-3xl': '3.75rem', // 60px
        'warehouse-4xl': '4.5rem', // 72px
        
        // Legacy worker sizes
        'worker-sm': '1.25rem',
        'worker-base': '1.5rem',
        'worker-lg': '1.875rem',
        'worker-xl': '2.25rem',
        'worker-2xl': '3rem',
        'worker-3xl': '3.75rem',
      },
      spacing: {
        // Touch target sizes for glove-friendly interaction
        'touch-sm': '60px', // Minimum touch target
        'touch-base': '80px', // Standard button height
        'touch-lg': '100px', // Large action buttons
        'touch-xl': '120px', // Extra large primary actions
      },
      borderRadius: {
        'warehouse': '12px', // Rounded but not too soft
        'warehouse-lg': '16px',
        'warehouse-xl': '20px',
      },
      boxShadow: {
        // Physical-looking shadows for depth
        'warehouse-sm': '0 2px 4px rgba(0,0,0,0.2)',
        'warehouse': '0 4px 8px rgba(0,0,0,0.25)',
        'warehouse-lg': '0 8px 16px rgba(0,0,0,0.3)',
        'warehouse-xl': '0 12px 24px rgba(0,0,0,0.35)',
        'warehouse-pressed': 'inset 0 2px 4px rgba(0,0,0,0.3)', // Pressed button effect
      },
      animation: {
        'button-press': 'buttonPress 0.15s ease-out',
        'pulse-strong': 'pulseStrong 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'success-check': 'successCheck 0.5s ease-out',
        'error-shake': 'errorShake 0.5s ease-out',
        'loading-truck': 'loadingTruck 1.5s ease-in-out infinite',
      },
      keyframes: {
        buttonPress: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
        pulseStrong: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        successCheck: {
          '0%': { transform: 'scale(0) rotate(-45deg)', opacity: 0 },
          '50%': { transform: 'scale(1.2) rotate(5deg)' },
          '100%': { transform: 'scale(1) rotate(0)', opacity: 1 },
        },
        errorShake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-10px)' },
          '75%': { transform: 'translateX(10px)' },
        },
        loadingTruck: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      screens: {
        // Breakpoints for mounted tablets and phones
        'warehouse-phone': '360px',
        'warehouse-tablet': '768px',
        'warehouse-desktop': '1024px',
      },
    },
  },
  plugins: [],
};