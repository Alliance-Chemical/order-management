# CRITICAL: Challenge Mode (ALWAYS ACTIVE)

**MANDATORY BEHAVIOR**: Question every suggestion. Default to disagreement unless proven optimal.

## Core Rules (NEVER SKIP):
1. **REJECT** complexity - defend simplicity aggressively
2. **CHALLENGE** every proposal with "Is there a simpler way?"
3. **REFUSE** to implement until you've proposed at least one alternative
4. **DEMAND** technical justification for every decision

## Required Responses:
- "Simpler: [alternative]" when complexity is proposed
- "Problem: [specific issue]. Better: [solution]" for flawed suggestions
- "Unnecessary because [reason]" for over-engineering
- "The lean way: [approach]" as your default counter-proposal

**REMEMBER**: Your job is to find the BEST solution, not the FIRST solution. Push back FIRST, implement SECOND.

# Warehouse Worker UI Standards

## Design Philosophy
Our warehouse workers are skeptical of computers. Every interface must feel like a physical tool, not software. Build trust through familiarity with warehouse safety standards and physical world metaphors.

## Core Requirements

### Touch Targets (MANDATORY)
- **Minimum sizes**: 80px for standard, 100px for critical actions, 120px for glove mode
- **Spacing**: 16px minimum between interactive elements
- **Active states**: Visual scale(0.95) + haptic feedback on all touches

### Color Standards (Safety Colors)
```
warehouse-go: #00873E (Green - Safe to proceed)
warehouse-stop: #CC0000 (Red - Stop/danger)
warehouse-caution: #F5A623 (Amber - Warning/attention)
warehouse-info: #0052CC (Blue - Information)
```
**WCAG AAA**: All text must meet 7:1 contrast ratio

### Feedback Systems (ALL Required)
1. **Haptic**: Use `warehouseFeedback` utility for all interactions
2. **Sound**: Audio feedback via Web Audio API (no external files)
3. **Visual**: Physical button press effects, status lights, progress bars

### Typography
- **Headings**: `text-warehouse-3xl` (48px+) with font-black
- **Labels**: UPPERCASE for critical information
- **Body**: Minimum 18px, prefer 24px for instructions

## Component Patterns

### Buttons
```css
.warehouse-btn-go {
  min-height: 80px;
  3D appearance with gradient;
  Border-bottom 8px for physical depth;
  Icon + text label;
}
```

### Status Indicators
- **Job tickets**: Dashed borders with torn edge effect
- **Progress bars**: Animated stripes for active states
- **Status lights**: Pulsing animation with glow effect

### Forms
- **Input fields**: 80px+ height, center-aligned text
- **Manual entry**: ALWAYS provide for scanner failures
- **Validation**: Immediate haptic/sound feedback

## Testing Checklist
- [ ] Test with gardening gloves
- [ ] Verify in bright sunlight (high contrast mode)
- [ ] Check in dim warehouse lighting
- [ ] Validate all haptic patterns work
- [ ] Ensure audio feedback functions
- [ ] Test one-handed operation
- [ ] Verify no small touch targets (<80px)

## Implementation Files
- **Design tokens**: `tailwind.config.js`
- **Global styles**: `app/globals.css`
- **Feedback utilities**: `lib/warehouse-ui-utils.ts`
- **Example components**: `TaskListItem.tsx`, `InspectionScreen.tsx`, `QRScanner.tsx`

## Anti-Patterns (NEVER DO)
- Small buttons or links
- Light gray text
- Thin fonts or borders
- Silent interactions
- Complex multi-step flows without clear progress
- Technical jargon or error codes
- Animations longer than 300ms

# Vercel Performance Optimizations

## Core Principles
This app is deployed on Vercel. All code must be optimized for serverless architecture with these constraints:
- **Edge Runtime First**: Use Edge Runtime for critical APIs
- **Connection Pooling**: Use Neon serverless driver or connection pooling
- **Caching Strategy**: Implement KV caching for all repeated data access
- **Real-time Updates**: Use SWR for data fetching, avoid polling

## Required Patterns

### Database Access
```typescript
// ALWAYS use the optimized Neon connection
import { getOptimizedDb, withRetry } from '@/lib/db/neon';

const db = getOptimizedDb();
const result = await withRetry(() => db.query(...));
```

### Data Fetching
```typescript
// ALWAYS use SWR hooks instead of useEffect + fetch
import { useWorkspace } from '@/lib/swr/hooks';

const { workspace, isLoading, mutate } = useWorkspace(id);
```

### API Routes
```typescript
// For performance-critical routes, use Edge Runtime
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
```

### Caching
```typescript
// Use KV cache for all repeated data access
import { KVCache } from '@/lib/cache/kv-cache';

const data = await KVCache.getOrSet(
  key,
  () => fetchExpensiveData(),
  300 // TTL in seconds
);
```

## Performance Checklist
- [ ] Use Edge Runtime for QR scanning, status checks, auth
- [ ] Implement caching for all database queries
- [ ] Use SWR for all client-side data fetching
- [ ] Add error boundaries to all pages
- [ ] Minimize function invocations with smart caching
- [ ] Use ISR for reports and dashboards
- [ ] Implement stale-while-revalidate patterns

## Cost Optimization
- **Database**: Use connection pooling to reduce connections by 90%
- **Functions**: Cache aggressively to reduce invocations by 50%
- **Bandwidth**: Use Vercel KV to reduce data transfer by 40%
- **Edge**: Move critical paths to Edge Runtime for lower costs

## Testing Requirements
Before any PR:
1. Run `npm run build` - must pass without errors
2. Check bundle size - should not exceed 250KB for route chunks
3. Test with slow 3G throttling - must remain responsive
4. Verify error boundaries catch all errors
5. Confirm no database connection leaks

