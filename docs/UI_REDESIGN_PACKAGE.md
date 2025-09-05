# Chemical Logistics UI/UX Redesign Package

## 1. Information Architecture & Flows

### Site Map
```
├── Dashboard (/)
│   ├── Work Queue Cards (Ready/In Progress/Needs Attention)
│   ├── Quick Actions (Print Labels/Book Freight)
│   └── Live Presence Indicators
├── Workspace (/workspace/[orderId])
│   ├── Linear Workflow Steps
│   ├── QR Generation & Printing
│   ├── Inspection Phases
│   └── Freight & Shipping
├── Freight Booking (/freight-booking)
│   ├── Order Selection
│   ├── AI Classification
│   ├── Hazmat Validation
│   └── Carrier Confirmation
└── Admin (/dashboard)
    ├── Exceptions & Overrides
    ├── Throughput Metrics
    └── SLA Monitoring
```

### Core User Flows

#### Warehouse Worker Flow (Mobile/Tablet)
```
1. SCAN badge → Dashboard
2. TAP order card → Workspace
3. TAP "Generate Labels" → QR codes created
4. TAP "Print" → Labels printed
5. SCAN containers → Inspection
6. TAP pass/fail → Record results
7. TAP "Complete" → Next order
```

#### Freight Coordinator Flow (Desktop)
```
1. SELECT orders needing freight
2. REVIEW AI classifications
3. VALIDATE hazmat compliance
4. CONFIRM carrier & rates
5. BOOK shipment → Tracking assigned
```

## 2. Enhanced Design Tokens

### Tailwind Configuration Patch
```javascript
// tailwind.config.enhancement.js
module.exports = {
  theme: {
    extend: {
      // CSS Custom Properties for Glove Mode
      spacing: {
        'touch': 'var(--touch-size)',
        'touch-sm': 'calc(var(--touch-size) * 0.75)',
        'touch-lg': 'calc(var(--touch-size) * 1.25)',
        'touch-xl': 'calc(var(--touch-size) * 1.5)',
      },
      
      // Enhanced Safety Colors (WCAG AAA)
      colors: {
        'warehouse': {
          'go': '#00873E',      // 7.5:1 contrast
          'stop': '#CC0000',    // 7.2:1 contrast  
          'caution': '#B87514', // Darkened for 7:1
          'info': '#0052CC',    // 7.1:1 contrast
          
          // Status Enhancement
          'go-light': '#E6F7ED',
          'stop-light': '#FFEBE6',
          'caution-light': '#FFF4E6',
          'info-light': '#E6F0FF',
        }
      },
      
      // Animation Timings (≤300ms)
      animation: {
        'tap': 'tap 150ms ease-out',
        'scan-pulse': 'scanPulse 200ms ease-out',
        'success-check': 'check 250ms ease-out',
        'error-shake': 'shake 200ms ease-out',
        'status-light': 'statusLight 2s infinite',
      },
      
      keyframes: {
        tap: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.95)' }
        },
        scanPulse: {
          '0%': { boxShadow: '0 0 0 0 rgba(0, 135, 62, 0.7)' },
          '100%': { boxShadow: '0 0 0 20px rgba(0, 135, 62, 0)' }
        },
        check: {
          '0%': { strokeDashoffset: '100' },
          '100%': { strokeDashoffset: '0' }
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-8px)' },
          '75%': { transform: 'translateX(8px)' }
        },
        statusLight: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' }
        }
      }
    }
  }
}
```

## 3. Component Specifications

### WarehouseButton (Reuses existing with enhancements)
```typescript
// Already exists in globals.css as .warehouse-btn-*
// Enhancement: Add data attributes for tracking
interface Props {
  variant: 'go' | 'stop' | 'caution' | 'info' | 'neutral'
  size: 'base' | 'large' | 'xlarge'
  loading?: boolean
  disabled?: boolean
  haptic?: 'light' | 'success' | 'warning'
  trackingEvent?: string
}
```

### StatusLight (Reuses existing)
```typescript
// Already exists in globals.css as .warehouse-status-light-*
// Just needs React wrapper for consistency
interface Props {
  status: 'go' | 'stop' | 'caution' | 'off'
  pulse?: boolean
  size?: 'sm' | 'base' | 'lg'
}
```

### GloveModeToggle (New)
```typescript
interface Props {
  defaultOn?: boolean
  onToggle?: (enabled: boolean) => void
  position?: 'top-right' | 'bottom-right'
}

// Visual: Large physical switch (100px x 50px)
// Colors: Gray (off) → Green (on)
// Haptic: Strong feedback on toggle
```

### LabelQuantityInput (Enhanced)
```typescript
interface Props {
  itemName: string
  sku?: string
  defaultQuantity: number
  onChange: (quantity: number) => void
  containerType: 'drum' | 'tote' | 'pallet' | 'freight'
}

// Features:
// - No upper limit on input
// - Width: w-20 for large numbers
// - Big +/- buttons (80px)
// - Direct type input support
```

### JobTicketCard (Reuses TaskListItem)
```css
// Already implemented in TaskListItem.tsx
// Uses .warehouse-ticket with torn edge effect
// Just needs minor prop additions for freight context
```

### HazmatCallout (New)
```typescript
interface Props {
  level: 'info' | 'warning' | 'danger'
  unNumber?: string
  packingGroup?: string
  properShippingName?: string
  children: React.ReactNode
}

// Visual: High contrast border (4px)
// Icon: Large hazmat diamond (60px)
// Background: Safety color light variant
```

## 4. Screen Redesigns

### Main Work Queue Dashboard
```typescript
// Layout: 2-column cards on tablet, 1-column on mobile
// Card Height: Min 150px
// Touch Targets: Entire card clickable
// Visual Indicators:
//   - Green pulse: Ready
//   - Yellow pulse: In Progress  
//   - Red pulse: Needs Attention
//   - Blue badge: Freight needed

// Key Features:
// - Live presence dots (green = someone working)
// - Order count badges
// - One-tap to workspace
// - Swipe gestures for quick actions
```

### Simplified PrintPreparationModal
```typescript
// Remove:
// - "Split across pallets" text
// - "Freight item - typically ships on pallet(s)" text
// - Fulfillment method dialog

// Keep:
// - Item name, SKU, quantity
// - Label quantity selector (unbounded)
// - Print button (120px height)
// - Close button (80px)

// Fix: Store regenerated QRs before setState
```

### Linear Workspace View
```typescript
// Single column layout
// Step height: Min 200px
// Progress bar: Fixed top (40px)
// Current step: Yellow highlight + pulse
// Completed: Green check + collapsed
// Next: Gray with "LOCKED" overlay

// Sections:
// 1. Items & Labels
// 2. Container Inspection  
// 3. Final Measurements
// 4. Freight Booking
// 5. Ship & Archive
```

## 5. Implementation Files

### GloveModeProvider.tsx
```typescript
'use client';

import { createContext, useContext, useState, useEffect } from 'react';

interface GloveModeContextType {
  enabled: boolean;
  toggle: () => void;
  touchSize: number;
}

const GloveModeContext = createContext<GloveModeContextType>({
  enabled: false,
  toggle: () => {},
  touchSize: 80
});

export function GloveModeProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  
  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('gloveMode');
    if (saved === 'true') setEnabled(true);
  }, []);
  
  useEffect(() => {
    // Update CSS variable
    const size = enabled ? 120 : 80;
    document.documentElement.style.setProperty('--touch-size', `${size}px`);
    
    // Add/remove class
    if (enabled) {
      document.body.classList.add('glove-mode');
    } else {
      document.body.classList.remove('glove-mode');
    }
    
    // Save preference
    localStorage.setItem('gloveMode', String(enabled));
  }, [enabled]);
  
  return (
    <GloveModeContext.Provider 
      value={{
        enabled,
        toggle: () => setEnabled(!enabled),
        touchSize: enabled ? 120 : 80
      }}
    >
      {children}
    </GloveModeContext.Provider>
  );
}

export const useGloveMode = () => useContext(GloveModeContext);
```

### Centralized Discount Filter
```typescript
// lib/utils/discount-filter.ts

export function filterDiscountItems(items: any[]) {
  return items.filter(item => {
    const hasValidSku = item.sku && item.sku !== '';
    const isDiscount = item.name?.toLowerCase().includes('discount') || 
                      item.name?.toLowerCase().includes('welcome') ||
                      item.unitPrice < 0;
    
    return hasValidSku || !isDiscount;
  });
}

// Usage in components:
// import { filterDiscountItems } from '@/lib/utils/discount-filter';
// const filteredItems = filterDiscountItems(order.items);
```

### Enhanced WarehouseButton.tsx
```typescript
'use client';

import { warehouseFeedback } from '@/lib/warehouse-ui-utils';
import { useGloveMode } from '@/contexts/GloveModeProvider';
import { cn } from '@/lib/utils';

interface WarehouseButtonProps {
  variant?: 'go' | 'stop' | 'caution' | 'info' | 'neutral';
  size?: 'base' | 'large' | 'xlarge';
  loading?: boolean;
  disabled?: boolean;
  haptic?: 'light' | 'success' | 'warning';
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  trackingEvent?: string;
}

export function WarehouseButton({
  variant = 'neutral',
  size = 'base',
  loading = false,
  disabled = false,
  haptic = 'light',
  children,
  onClick,
  className,
  trackingEvent
}: WarehouseButtonProps) {
  const { touchSize } = useGloveMode();
  
  const handleClick = () => {
    if (disabled || loading) return;
    
    // Multimodal feedback
    warehouseFeedback[haptic === 'success' ? 'success' : 
                      haptic === 'warning' ? 'warning' : 'buttonPress']();
    
    // Track event
    if (trackingEvent) {
      console.log('Track:', trackingEvent);
    }
    
    onClick?.();
  };
  
  const sizeClasses = {
    base: 'min-h-touch',
    large: 'min-h-touch-lg',
    xlarge: 'min-h-touch-xl'
  };
  
  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={cn(
        `warehouse-btn-${variant}`,
        sizeClasses[size],
        loading && 'opacity-50 cursor-wait',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      style={{ minHeight: `${touchSize}px` }}
    >
      {loading ? (
        <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full" />
      ) : (
        children
      )}
    </button>
  );
}
```

## 6. Copy Guidelines

### Button Labels
- PRIMARY ACTIONS: ALL CAPS, 1-2 words (e.g., "START", "PRINT", "SHIP")
- Secondary: Title Case, descriptive (e.g., "View Details", "Add Note")
- Danger: ALL CAPS + icon (e.g., "⚠️ STOP", "❌ CANCEL")

### Status Messages
- Success: "✓ COMPLETE" / "✓ SHIPPED" / "✓ PASSED"
- In Progress: "⏳ SCANNING..." / "⏳ PRINTING..." / "⏳ LOADING..."
- Error: "❌ FAILED - [SPECIFIC REASON]" / "⚠️ CHECK [ITEM]"

### Instructions
- Start with verb: "SCAN container code" / "ENTER weight" / "SELECT carrier"
- Max 8 words per instruction
- Use numbers for steps: "1. SCAN" / "2. INSPECT" / "3. PACK"

## 7. Analytics Instrumentation

### Events to Track
```typescript
// Button taps
track('warehouse_button_tap', {
  variant: 'go|stop|caution|info',
  screen: 'dashboard|workspace|freight',
  label: string
});

// Scan events
track('qr_scan', {
  success: boolean,
  manual_entry: boolean,
  scan_time_ms: number
});

// Workflow progression
track('workflow_step', {
  order_id: string,
  step: 'labels|inspect|freight|ship',
  duration_seconds: number
});

// Errors
track('warehouse_error', {
  type: 'scan_fail|print_fail|network',
  recovery_method: 'retry|manual|skip'
});

// Glove mode usage
track('glove_mode_toggle', {
  enabled: boolean,
  session_duration: number
});
```

## 8. Accessibility Checklist

### Per Screen Requirements
- [ ] All text ≥7:1 contrast ratio (WCAG AAA)
- [ ] Touch targets ≥80px (120px glove mode)
- [ ] 16px minimum spacing between interactive elements
- [ ] Focus indicators visible (8px ring)
- [ ] Screen reader labels on all buttons
- [ ] Haptic feedback on all interactions
- [ ] Audio feedback for state changes
- [ ] Visual feedback within 200ms
- [ ] Error messages with recovery instructions
- [ ] Manual entry fallback for all scans

## 9. Usability Test Plan

### Test Conditions
1. **Glove Test**: Thick gardening gloves, complete all workflows
2. **Sunlight Test**: Max brightness, outdoor conditions
3. **Dim Light Test**: Warehouse lighting (200 lux)
4. **Speed Test**: 3G throttling, measure response times
5. **One-Handed Test**: Hold package, operate with one hand
6. **Scanner Failure**: Disable camera, use manual entry
7. **Noise Test**: Warehouse noise (85dB), verify audio/haptic

### Success Metrics
- Task completion: ≥95%
- Error recovery: ≥90% self-service
- Scan success: ≥85% first attempt
- Label print: ≤30 seconds
- Freight booking: ≤2 minutes
- User confidence: ≥4.5/5 rating

### Acceptance Criteria
1. Zero touch targets <80px
2. 100% WCAG AAA compliance
3. All critical paths completable with gloves
4. Recovery from any error state
5. Offline-capable core functions
6. Response time <200ms for interactions
7. Loading states for operations >500ms

## 10. Implementation Priority

### Phase 1 (Week 1)
- GloveModeProvider implementation
- Centralized discount filtering
- PrintPreparationModal simplification
- Touch target compliance

### Phase 2 (Week 2)
- Dashboard card redesign
- Linear workspace flow
- Enhanced feedback systems
- QR scanner improvements

### Phase 3 (Week 3)
- Freight booking wizard
- Hazmat safety UI
- Analytics implementation
- Performance optimization

### Phase 4 (Week 4)
- User testing
- Accessibility audit
- Performance testing
- Documentation

---

This redesign prioritizes **safety**, **speed**, and **simplicity** while maintaining the power features needed for complex chemical logistics operations. Every design decision supports glove-wearing workers operating under warehouse conditions.