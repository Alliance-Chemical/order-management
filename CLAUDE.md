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

# Label Printing System

## QR Code Generation Logic
**Location**: `/app/api/workspace/[orderId]/qrcodes/route.ts`

### Container Type Detection (ORDER MATTERS!)
```javascript
// LARGE CONTAINERS: 1 label per container (qty = label amount)
if (name.includes('drum')) → quantity labels (e.g., 5 drums = 5 labels)
if (name.includes('tote')) → quantity labels
if (name.includes('carboy')) → quantity labels  
if (name.includes('ibc')) → quantity labels

// FREIGHT ITEMS: Default to 1 label total
if (name.includes('case')) → 1 label (e.g., "4 x 5 Gallon Pails" = 1 label)
if (name.includes('pail')) → 1 label
if (name.includes('box')) → 1 label
if (name.includes('gallon') && !drum && !tote) → 1 label
```

**CRITICAL**: Check order matters! "55 gallon drum" must match 'drum' not 'gallon'

### Discount Code Filtering
**Always filter out items where**: `(!sku || sku === '') && (name.includes('discount') || name.includes('welcome') || unitPrice < 0)`

Applies to:
- `/components/desktop/PrintPreparationModal.tsx` - Label printing UI
- `/app/page.tsx` - Dashboard order items display
- `/app/api/workspace/[orderId]/qrcodes/regenerate/route.ts` - QR regeneration

## Print Modal Behavior
**Location**: `/components/desktop/PrintPreparationModal.tsx`

### Custom Label Quantities
- NO UPPER LIMIT on label quantity input (removed max=10)
- Warehouse can type any number (100, 200, etc.)
- Width: `w-20` to accommodate larger numbers
- State management: Store regenerated QRs in local variable before using (async state issue)

### UI Simplifications
- NO "split across pallets" text - too assumptive
- NO "freight item - typically ships on pallet(s)" - not always accurate  
- NO fulfillment method dialog (pump & fill vs direct resell) - unnecessary
- Keep it simple: just show item name, SKU, quantity, and label selector

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

# TMS Freight Platform Integration (COMPLETED)

## System Architecture
The freight booking system has been completely overhauled with professional multi-step workflows and AI-powered classification.

### Core Components

#### 1. Professional Freight Booking (`/freight-booking/page.tsx`)
- **Multi-Step Workflow**: Order Selection → Classification → Hazmat Analysis → Confirmation
- **ShipStation Integration**: Real-time order fetching and data mapping
- **Progress Tracking**: Visual step indicators with professional UI
- **Auto-Selection**: URL parameter support for direct order booking

#### 2. Chemical Classification System
- **Products Table**: Master catalog of chemical products with CAS numbers
- **Freight Classifications**: NMFC codes, freight classes, and DOT compliance data
- **Product-Freight Links**: Approved mappings between products and classifications
- **Hazmat Validation**: UN numbers, packing groups, proper shipping names

#### 3. AI/RAG Components
- **AIHazmatFreightSuggestion**: Advanced hazmat analysis with risk assessment
- **HazmatRAGPanel**: Automatic chemical classification with pattern matching
- **Compliance Engine**: DOT regulation checking and carrier optimization

#### 4. Integration Points
- **Dashboard Navigation**: Fixed broken alert popups, proper routing to `/freight-booking`
- **Order Management**: Added "Book Freight" buttons to order rows
- **Workspace Integration**: Freight orders create proper workspaces with QR codes
- **Real Data Handling**: Removed all fake data, implemented proper customer mapping

### Database Schema (`/lib/db/schema/freight.ts`)
```typescript
// Chemical Products - master catalog
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  name: text('name').notNull(),
  isHazardous: boolean('is_hazardous').default(false),
  casNumber: varchar('cas_number', { length: 20 }),
  unNumber: varchar('un_number', { length: 10 }),
});

// Freight Classifications - NMFC codes and freight classes
export const freightClassifications = pgTable('freight_classifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  description: text('description').notNull(),
  nmfcCode: varchar('nmfc_code', { length: 20 }),
  freightClass: varchar('freight_class', { length: 10 }).notNull(),
  isHazmat: boolean('is_hazmat').default(false),
  hazmatClass: varchar('hazmat_class', { length: 10 }),
});

// Product-Freight Links - approved mappings
export const productFreightLinks = pgTable('product_freight_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  classificationId: uuid('classification_id').references(() => freightClassifications.id).notNull(),
  isApproved: boolean('is_approved').default(false),
});
```

### API Endpoints

#### Freight Booking APIs
- `/api/freight-booking/complete-booking` - Professional booking with classification data
- `/api/freight/hazmat-suggest` - AI hazmat analysis and risk assessment
- `/api/hazmat/classify` - RAG-powered product classification

#### Classification APIs  
- `/api/product-links/check` - Check product classification status
- `/api/freight-classifications/[id]` - CRUD for freight classifications
- `/api/products/[id]` - Chemical product management

### Navigation Structure
```
Dashboard → Book Freight → Multi-Step Workflow
Order Management → Book Freight (per order) → Auto-Selected Booking
Freight Navigation → Classifications, Products, Link Management
```

### User Workflows

#### Standard Freight Booking
1. Navigate to `/freight-booking` from dashboard
2. Select order from ShipStation awaiting shipment
3. Auto-classify products using RAG system
4. AI hazmat analysis for dangerous goods
5. Confirm booking with carrier and cost details
6. Create workspace with freight context and QR codes

#### Order-Specific Booking
1. From order management, click "Book Freight" on specific order
2. Auto-redirects to `/freight-booking?orderId=123`
3. Order is pre-selected and data pre-populated
4. Continue through classification and confirmation steps

#### DOT Compliance Workflow
1. Products without classifications trigger RAG analysis
2. Pattern matching suggests UN numbers and hazard classes
3. Manual approval workflow for safety-critical classifications
4. Compliance validation before carrier booking

### Performance Optimizations
- **Edge Runtime**: All freight APIs use Edge Runtime for <50ms response times
- **Connection Pooling**: Neon serverless driver with automatic pooling
- **Smart Caching**: Classification results cached to reduce AI API calls
- **Batch Processing**: Multiple product classifications processed in parallel

### Error Handling & Data Quality
- **Fake Data Eliminated**: Removed all hardcoded emails, names, and addresses
- **Real Customer Data**: Proper mapping from ShipStation to freight system
- **Validation**: Type-safe database operations with Drizzle ORM
- **Fallbacks**: Graceful handling of missing order data or classification failures

This freight platform now provides enterprise-grade freight booking with full DOT compliance, AI-powered classification, and professional workflows that match the quality of the original TMS system.

