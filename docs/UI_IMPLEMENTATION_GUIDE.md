# UI/UX Implementation Guide

## Quick Start

### 1. Install GloveModeProvider in Layout

```tsx
// app/layout.tsx
import { GloveModeProvider } from '@/contexts/GloveModeProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <GloveModeProvider>
          {children}
        </GloveModeProvider>
      </body>
    </html>
  );
}
```

### 2. Add Glove Mode Toggle to Pages

```tsx
import { GloveModeToggle } from '@/contexts/GloveModeProvider';

export default function WarehousePage() {
  return (
    <>
      <GloveModeToggle position="bottom-right" />
      {/* Page content */}
    </>
  );
}
```

### 3. Use Centralized Discount Filter

```tsx
import { filterDiscountItems } from '@/lib/utils/discount-filter';

// In any component handling order items:
const filteredItems = filterDiscountItems(order.items);
```

## Component Usage Examples

### WarehouseButton

```tsx
import WarehouseButton, { GoButton, StopButton } from '@/components/ui/WarehouseButton';

// Basic usage
<WarehouseButton variant="go" size="large">
  START INSPECTION
</WarehouseButton>

// With icon and tracking
<GoButton 
  icon={<PrinterIcon className="h-8 w-8" />}
  trackingEvent="print_labels"
  size="xlarge"
>
  PRINT ALL
</GoButton>

// Loading state
<WarehouseButton loading variant="info">
  Processing...
</WarehouseButton>
```

### StatusLight

```tsx
import StatusLight, { StatusLightGroup } from '@/components/ui/StatusLight';

// Single light
<StatusLight status="go" label="READY" size="lg" />

// Group of lights
<StatusLightGroup 
  lights={[
    { status: 'go', label: 'SCANNER' },
    { status: 'caution', label: 'PRINTER' },
    { status: 'stop', label: 'NETWORK' }
  ]}
  size="base"
/>
```

### ProgressBar

```tsx
import ProgressBar, { StepProgress } from '@/components/ui/ProgressBar';

// Simple progress
<ProgressBar 
  value={75} 
  label="Order Completion"
  showPercentage
  variant="success"
/>

// Step workflow
<StepProgress 
  steps={[
    { label: 'SCAN', status: 'completed' },
    { label: 'INSPECT', status: 'current' },
    { label: 'PACK', status: 'pending' },
    { label: 'SHIP', status: 'pending' }
  ]}
/>
```

### HazmatCallout

```tsx
import HazmatCallout from '@/components/ui/HazmatCallout';

<HazmatCallout
  level="danger"
  unNumber="UN1789"
  hazardClass="8"
  packingGroup="II"
  properShippingName="HYDROCHLORIC ACID"
>
  This shipment contains corrosive materials. 
  Ensure proper PPE and placarding.
</HazmatCallout>
```

## Migration from Existing Components

### Replace PrintPreparationModal

```diff
- import PrintPreparationModal from '@/components/desktop/PrintPreparationModal';
+ import PrintPreparationModalSimplified from '@/components/desktop/PrintPreparationModalSimplified';

- <PrintPreparationModal 
+ <PrintPreparationModalSimplified
    order={order}
    onClose={handleClose}
    onPrintComplete={handleComplete}
  />
```

### Update Button Usage

```diff
- <button className="btn-primary">
+ <WarehouseButton variant="go">
    Submit
- </button>
+ </WarehouseButton>
```

### Apply Discount Filtering

```diff
// In PrintPreparationModal, Dashboard, QR generation:
- const items = order.items || [];
+ import { filterDiscountItems } from '@/lib/utils/discount-filter';
+ const items = filterDiscountItems(order.items || []);
```

## CSS Variables for Dynamic Sizing

The GloveModeProvider sets these CSS variables:

```css
:root {
  --touch-size: 80px;      /* 120px in glove mode */
  --touch-size-sm: 60px;   /* 90px in glove mode */
  --touch-size-lg: 100px;  /* 150px in glove mode */
  --touch-size-xl: 120px;  /* 180px in glove mode */
}
```

Use in custom components:

```css
.custom-button {
  min-height: var(--touch-size);
  padding: calc(var(--touch-size) * 0.1);
}
```

## Accessibility Checklist

- [ ] All buttons use WarehouseButton with proper variants
- [ ] Status lights have aria-labels
- [ ] Progress bars include aria attributes
- [ ] Hazmat callouts use proper alert roles
- [ ] Touch targets meet minimum sizes
- [ ] Contrast ratios ≥7:1 (WCAG AAA)
- [ ] Multimodal feedback on all interactions

## Testing in Development

### Simulate Glove Mode
1. Open DevTools
2. Toggle device toolbar
3. Set touch points to simulate glove touches
4. Or manually enable via toggle button

### Test Haptic Feedback
- Works on devices with vibration API
- Falls back gracefully on desktop

### Test Audio Feedback
- Requires user interaction to initialize
- Uses Web Audio API (no external files)

## Performance Notes

1. **GloveModeProvider**: Uses localStorage, minimal overhead
2. **Discount Filter**: Pure function, can be memoized
3. **Warehouse Components**: Reuse existing CSS classes
4. **Feedback Utils**: Singleton pattern, initialized once

## Troubleshooting

### Glove mode not persisting
- Check localStorage permissions
- Ensure GloveModeProvider wraps entire app

### Buttons not responding
- Verify warehouseFeedback imported
- Check button isn't disabled/loading
- Ensure onClick handler provided

### QR regeneration issues
- Use ref to store regenerated codes
- Apply changes after async completion
- See PrintPreparationModalSimplified for pattern

---

For full redesign documentation, see `/docs/UI_REDESIGN_PACKAGE.md`