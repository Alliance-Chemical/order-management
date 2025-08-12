Workspace Order Management System
Project Overview
This is a Next.js-based order management workspace for tracking and processing chemical orders. The system provides a clean, modular interface for managing order workflows, customer information, and documentation, all backed by a PostgreSQL database.
Tech Stack
Framework: Next.js 15.4.6 with Turbopack (App Router)
Database: PostgreSQL with Drizzle ORM
Styling: Tailwind CSS v4 with PostCSS
UI Components: Custom React components with @heroicons/react
State Management: Zustand (Client-side) & React Query (Server-side Data Fetching)
Language: TypeScript
Backend Services: Next.js API Routes, AWS SDK for S3, SQS, SNS
Deployment: Vercel (Frontend), AWS (Services)
Project Structure
code
Code
/app/
  ├── workspace/[orderId]/
  │   └── page.tsx                    # Main dynamic workspace page
  └── api/
      ├── activity/                   # Activity log endpoints
      ├── documents/                  # Document upload endpoints
      ├── freight-orders/             # ShipStation polling endpoint
      ├── qr/                         # QR generation, scanning, printing
      ├── shipstation/                # ShipStation search endpoint
      ├── webhook/                    # ShipStation webhook handler
      └── workspace/                  # Core workspace CRUD endpoints

/components/
  ├── workspace/
  │   ├── worker-view/                # Simplified UI for warehouse workers
  │   └── supervisor-view/             # Full-featured management interface
  └── qr/                             # QR code scanner UI component

/lib/
  ├── db/                             # Drizzle ORM setup and schema definitions
  ├── services/                       # Business logic (Workspace, ShipStation, QR)
  └── aws/                            # AWS SDK clients (S3, SNS, SQS)

/drizzle/                             # Drizzle ORM migration files

/lambda/                              # (Future Deployment) AWS Lambda function code
  ├── qr-generator.js
  └── qr-scanner.js

/scripts/                             # Utility and maintenance scripts
  ├── init-database.ts                # Initialize database schema
  ├── archive-orders.ts               # Archive old orders
  ├── setup-aws-resources.ts          # Setup AWS resources
  ├── reset-database.ts               # Clear all database tables
  ├── check-qr-codes.ts               # Diagnostic tool for QR codes
  ├── apply-schema-cleanup.ts         # Remove redundant columns
  └── clean-schema.sql                # SQL for schema cleanup

/middleware.ts                        # Authentication and API protection
Key Features
1. Database-Driven Architecture
PostgreSQL Database: All workspace data is persisted in a robust SQL database.
Drizzle ORM: Modern, TypeScript-native ORM for type-safe database queries. Schema is defined in /lib/db/schema/qr-workspace.ts.
Migrations: Database schema changes are managed via Drizzle Kit migrations in /drizzle.
2. Service-Oriented Backend
Modular Services: Business logic is cleanly separated into services (WorkspaceService, ShipStationClient, QRGenerator) located in /lib/services.
API Layer: Next.js API Routes provide a clear, RESTful interface to the frontend.
3. Real-time Updates & Automation
ShipStation Webhook: The endpoint at /app/api/webhook/shipstation/route.ts automatically creates workspaces when freight orders are tagged.
Background Polling: A manual polling endpoint at /api/freight-orders/poll can sync all freight orders and create missing workspaces.
Auto-Refresh: The workspace UI polls for fresh data every 30 seconds to ensure data is current.
API Endpoints
The application exposes these core Next.js API endpoints:
code
Code
# Workspace Management
GET    /api/workspace/{orderId}          # Fetch a single workspace's data
PUT    /api/workspace/{orderId}          # Update a workspace module's state
POST   /api/workspace/create             # Manually create a new workspace

# QR Code System
POST   /api/qr/generate                  # Generate QR code data and save to DB
POST   /api/qr/scan                      # Process a QR scan event
POST   /api/qr/print                     # Generate a printable PDF of QR labels

# Document Handling
POST   /api/documents/upload             # Upload a document to S3 and link to workspace

# Activity & Notifications
GET    /api/activity/{orderId}           # Fetch activity log for a workspace
POST   /api/workspace/{orderId}/notify   # Trigger an SNS notification for an event

# ShipStation Integration
GET    /api/freight-orders/poll          # Poll for all active freight orders
POST   /api/shipstation/orders/search    # Search for specific orders in ShipStation
POST   /api/webhook/shipstation          # Endpoint for ShipStation webhooks
Completed Features
✅ PostgreSQL Database Integration
Migrated from a file-based system to a full PostgreSQL database.
Implemented a comprehensive 6-table schema (workspaces, qr_codes, documents, alert_configs, alert_history, activity_log).
All data operations are now transactional and type-safe via Drizzle ORM.
**Schema Cleanup (January 12, 2025)**: Removed redundant columns (master_qr_id, container_qr_ids, qr_generation_rule, shipstation_order_id, s3_bucket_name) to simplify schema and eliminate confusion.
✅ QR Code System
Backend Logic: QR codes are generated, stored, and tracked in the PostgreSQL database.
Print Functionality: /api/qr/print endpoint generates a PDF of selected QR codes for physical labeling.
Scanner Component: A reusable React component at /components/qr/QRScanner.tsx.
✅ Authentication Middleware
The middleware.ts file intercepts requests to protected pages and API routes.
Currently configured for development with placeholder logic but structured for JWT/API key validation.
✅ ShipStation Webhook Integration
The webhook endpoint at /app/api/webhook/shipstation/route.ts is fully functional.
It correctly identifies freight orders, creates a corresponding workspace record in the database, and queues a QR generation job via SQS.
✅ Dual-Interface Worker/Supervisor Views
Worker View: Simplified, one-task-at-a-time interface for warehouse floor workers with high-contrast theme, large touch targets, and no-typing-required interactions.
Supervisor View: Original comprehensive tabbed interface with full access to all modules and detailed information.
State-driven routing automatically shows appropriate view based on workflow phase and user preference.
✅ Work Queue Dashboard with Enhanced Order Details
The main dashboard (/) displays all freight-tagged orders ready for processing with:
- Customer names fetched from ShipStation API (shipTo.name field)
- Order totals and dates
- Expandable rows to view order items with SKU, product name, quantity, unit price, and line totals
- Auto-refresh every 30 seconds to keep data current
- The /api/freight-orders/poll endpoint returns complete order information including customer details and items
Development Commands
code
Bash
# Start development server
npm run dev

# Build for production
npm run build

# --- Database Commands ---
# Initialize the schema in the database (run once)
npm run db:init

# Generate SQL migration file from schema changes
npm run db:migrate

# Apply migrations to the database
npm run db:push

# Open Drizzle Studio to view/edit data
npm run db:studio

# --- Testing Commands ---
# Run unit and integration tests
npm test                # Watch mode
npm run test:run        # Run once
npm run test:ui         # Open Vitest UI
npm run test:coverage   # Generate coverage report

# Run end-to-end tests
npm run test:e2e        # Run Playwright tests
npm run test:e2e:ui     # Open Playwright UI
npm run test:e2e:debug  # Debug mode

# Run all tests
npm run test:all        # Run both unit and E2E tests
Environment Variables
Required in .env.local:
code
Code
# Database
DATABASE_URL="postgres://..."

# ShipStation API
SHIPSTATION_API_KEY="..."
SHIPSTATION_API_SECRET="..."
FREIGHT_ORDER_TAG=19844
READY_TO_SHIP_TAG=19845

# AWS Credentials & Resources
AWS_REGION="us-east-2"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
S3_DOCUMENTS_BUCKET="alliance-chemical-documents"
QR_GENERATION_QUEUE_URL="..."
ALERT_QUEUE_URL="..."
SNS_SUPERVISOR_ALERTS_TOPIC="..."

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Google Gemini AI
GEMINI_API_KEY="..."
Worker View Features
The Worker View provides a radically simplified interface designed for warehouse floor operations:

Entry Screen (/components/workspace/worker-view/EntryScreen.tsx)
- Large, clear display of order number and customer information
- Single prominent action button to begin inspection
- Dynamic button text based on workflow phase (Pre-Mix or Pre-Ship)

Inspection Screen (/components/workspace/worker-view/InspectionScreen.tsx)
- Shows one inspection item at a time
- Large PASS/FAIL buttons for easy interaction with gloves
- Visual progress bar showing completion status
- Back navigation to review previous items
- Automatic advancement through inspection checklist

Issue Modal (/components/workspace/worker-view/IssueModal.tsx)
- Touch-only interface with predefined issue types
- Visual icons for each failure reason
- Instant SNS notification to supervisors
- No keyboard input required

High-Contrast Theme
- Custom Tailwind configuration for maximum visibility
- Minimum button height of 60px
- Text sizes from 18px to 48px
- Strong color contrast (green for pass, red for fail)

Testing Worker View
Navigate to http://localhost:3000/workspace/12345 to see a demo workspace in Pre-Mix inspection phase. The page defaults to Worker View and includes sample customer and item data for testing.

AI-Powered Features (Implemented with Google Gemini)
✅ AI-Assisted Issue Reporting
Workers can report inspection failures via voice notes and photos without typing. The system uses Google Gemini to:
- Transcribe and analyze voice descriptions
- Detect damage patterns in images
- Auto-classify issue severity
- Escalate critical issues to supervisors instantly
API Endpoint: `/api/ai/issue-report`
Component: `/components/workspace/worker-view/AIIssueReporter.tsx`

✅ Automated Document OCR
Automatically extracts data from Bills of Lading (BOLs) and Certificates of Analysis (COAs) using Gemini Vision:
- Parses key fields with confidence scoring
- Validates extracted data for completeness
- Flags documents requiring manual review
- Stores structured data directly in workspace
API Endpoint: `/api/ai/document-ocr`
Component: `/components/workspace/AIDocumentUpload.tsx`

✅ Predictive Anomaly Detection
Background analysis of historical inspection data to identify risk patterns:
- Detects statistical correlations between products/customers/failures
- Predicts failure rates for specific combinations
- Sends proactive alerts for high-risk patterns
- Provides AI-generated recommendations
API Endpoint: `/api/ai/anomaly-detection`
Dashboard: `/anomaly-dashboard`

Testing Suite
The application includes a comprehensive testing framework with Playwright for E2E tests and Vitest for unit/integration tests.

## Test Environment Setup

### 1. Environment Configuration
Create `.env.test` with test-specific database:
```env
DATABASE_URL="postgres://[connection-string]/qr-workspace-test?sslmode=require"
SHIPSTATION_API_KEY="test-api-key"
AWS_REGION="us-east-2"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 2. Database Preparation
```bash
# Push schema to test database
npm run db:push

# Seed test data
npx tsx scripts/seed-test-order.ts
```

### 3. Running Tests

#### Playwright E2E Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- tests/e2e/simple-workflow.spec.ts

# Run with UI (interactive mode)
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

#### Vitest Unit/Integration Tests
```bash
# Run unit tests
npm test              # Watch mode
npm run test:run      # Run once
npm run test:ui       # Open Vitest UI
npm run test:coverage # Generate coverage report
```

## Test Coverage

### E2E Tests (`/tests/e2e/`)
- **simple-workflow.spec.ts**: Basic workspace navigation and view switching
  - ✅ Verifies order #67890 workspace loads correctly
  - ✅ Tests tab navigation in supervisor view
  - ✅ Validates view switching between supervisor/worker modes
  - Status: **ALL PASSING**

- **full-order-workflow.spec.ts**: Complete order processing workflow
  - Tests work queue dashboard with order details
  - Simulates QR code generation and printing
  - Tests inspection workflow with pass/fail actions
  - Validates database updates and state transitions
  - Tests failure reporting and supervisor notifications
  - Status: **Requires database schema updates to pass**

### Test Data
The seed script (`scripts/seed-test-order.ts`) creates:
- Order #67890 for "Acme Chemical Co."
- Pre-Mix inspection items (Sodium Hydroxide, Citric Acid, D-Limonene)
- Master and container QR codes
- Complete ShipStation data structure

### Playwright Configuration
- **Ports**: Tests run on port 3003 (auto-detected when 3000 is in use)
- **Browsers**: Desktop Chrome and Mobile Chrome (Pixel 5)
- **Screenshots**: Captured on test failures
- **Traces**: Recorded on first retry
- **HTML Report**: Generated after test runs at http://localhost:9323

## Test Results Summary
- **Simple Workflow Tests**: ✅ 4/4 passing (2 desktop, 2 mobile)
- **Source Container Tests**: ✅ 16/16 passing (8 desktop, 8 mobile)
  - Shopify Product Sync: All tests passing
  - Source Container Selector UI: All tests passing
  - Label Printing: All tests passing
  - Integration Tests: Complete workflow validated
- **Full Order Workflow Tests**: ⚠️ 0/4 passing (requires database field alignment)
- **Total**: 20/24 tests passing

## Test Database Helper
The test helper (`/tests/helpers/db.ts`) provides:
- Automatic loading of `.env.test` configuration
- Database connection management
- Test data cleanup utilities
- Seed data functions

## Supervisor Source Assignment System (Completed Feature)

### Overview
Implemented a comprehensive source container assignment system that requires supervisors to digitally assign specific bulk containers to orders before printing labels. This ensures complete traceability from bulk source containers to final shipped products. **Updated January 12, 2025**: Now supports multiple source containers per item for complex filling operations.

### Features
1. **Shopify Product Integration** (`/api/shopify/sync-products`)
   - GET endpoint fetches all products directly from Shopify API
   - Returns simplified product data (id, title, SKU, barcode)
   - No database table required - fetches fresh data on each request
   - Supports grouping by base product (without size variations)

2. **Source Container Assignment UI** (`SourceContainerSelector` component)
   - Integrated into PrintPreparationModal (renamed to "Order Assignment & Label Printing")
   - **Removed packing configuration details section for cleaner UI**
   - **No longer auto-selects products** - users have full control to choose
   - Allows supervisors to select:
     - Chemical product from Shopify catalog (with search functionality)
     - Container type: 275 Gal Tote, 55 Gal Drum, or 330 Gal Drum
     - Optional container ID (e.g., T-001, D-055)
   - Shows clear summary before confirmation

3. **Multiple Source Container Support** (NEW)
   - **Support for multiple source containers per line item**
   - Useful when filling from multiple bulk containers (e.g., 2 totes used to fill 10 drums)
   - Two assignment modes:
     - **Add Source**: Adds additional source container to existing list
     - **Replace All**: Clears existing sources and assigns new one
   - Visual display shows all assigned sources with numbered list
   - Backend API supports both add and replace modes

4. **Assignment Persistence** (`/api/workspace/[orderId]/assign-source`)
   - Stores source assignments in workspace moduleStates
   - **Now supports multiple containers per lineItemId**
   - Tracks: lineItemId, sourceContainerId, sourceContainerName, assignedBy, assignedAt
   - Creates activity log entries for audit trail
   - GET endpoint retrieves current assignments for display
   - Prevents duplicate source containers for same item

5. **Label Enhancement** (`/api/qr/print`)
   - Includes source container information on printed labels
   - Source info passed via sourceAssignments parameter
   - Maintains professional label format with source traceability

6. **Worker View Integration** (`InspectionScreen`)
   - Fetches and displays ALL source assignments for current inspection item
   - Shows prominent blue box with numbered list of source containers
   - Displays "Fill From Sources:" with all assigned containers listed
   - Workers can see when multiple bulk containers should be used

### Business Rules Enforced
- **Print Prevention**: Label printing is disabled until ALL items have at least one source container assigned
- **Visual Indicators**: Shows numbered list of all assigned sources, red warning for unassigned items
- **Multiple Sources**: Each item can have unlimited source containers assigned
- **No Duplicates**: Same source container cannot be assigned twice to same item

### Workflow
1. Supervisor opens PrintPreparationModal for an order
2. System shows all order items requiring source assignment
3. For each item, supervisor can:
   - Click "Add Source" to assign additional source containers
   - Click "Replace All" to clear and reassign sources
4. Selects chemical product, container type, and optional ID
5. Assignment is saved to database via API
6. Can repeat to add multiple sources per item as needed
7. Print button remains disabled until ALL items have at least one source assigned
8. Labels are printed with source information included
9. Workers see all source assignments during inspection workflow

### Container Types Supported
- **275 Gal Tote** (IBC Tote Container)
- **55 Gal Drum** (Standard Drum)
- **330 Gal Drum** (Bulk Storage Drum)

### Benefits
- **Complete Traceability**: Every container can be traced back to its bulk source(s)
- **Complex Operations**: Supports scenarios where multiple sources fill single order
- **Error Prevention**: Workers can't start filling without proper source assignment
- **Audit Trail**: All assignments are logged with timestamp and user
- **Clear Communication**: All source info appears on labels and in worker interface
- **Flexibility**: Supports multiple container types and multiple sources per item

## GitHub Repository
The project is now hosted on GitHub at: https://github.com/andretaki/order-management

- Clean repository with no secrets in history
- Comprehensive README documentation
- All sensitive files properly gitignored
- Ready for collaboration and CI/CD integration

## Recent Fixes and Improvements

### Archive Script S3 Bucket Fix (January 12, 2025)
**Problem**: TypeScript errors in archive-orders.ts referencing removed `s3BucketName` column

**Solution**: Updated script to use centralized S3_DOCUMENTS_BUCKET environment variable instead of per-workspace bucket names

### QR Code Scanning and Inspection Updates (January 12, 2025)
**Problems Addressed**:
1. Pre-mix inspection had inappropriate documentation question
2. QR scanning steps showed "Scan" but had no camera functionality
3. Workers couldn't see order details during inspection
4. QR URLs had newline characters breaking mobile scanning

**Solutions Implemented**:
1. **Removed Documentation Check from Pre-Mix**:
   - Removed "Verify COA, SDS, and other docs present" from pre-mix inspection
   - Documentation check remains only in pre-ship where appropriate
   
2. **Added Functional QR Scanning**:
   - Integrated QRScanner component with camera access
   - "SCAN QR" button with camera icon for scan-required items
   - Visual confirmation when QR successfully scanned
   - Scan data sent to backend for tracking
   
3. **Enhanced Order Context Display**:
   - Added order information bar showing Order #, Customer Name
   - Display list of items being inspected with quantities
   - Workers and agents can see exactly what products are in the order
   
4. **Fixed QR URL Generation**:
   - Added `.trim()` to base URLs to remove whitespace/newlines
   - Fixed mobile scanning issues with %0A character in URLs

5. **Updated Pre-Mix Inspection Checklist**:
   - Scan Source QR (new)
   - Verify Source Chemical (new)
   - Container Condition
   - Label Verification
   - Quantity Check
   - Scan Destination QR (new)
   - Hazmat Placards
   - Seal Integrity

### Custom Discount Import in Worker View (January 12, 2025)
**Problem**: Discount information from ShipStation orders was being filtered out and not displayed in the worker view during pre-mix inspection.

**Solution Implemented**:
1. **Updated API Endpoints** to include discount data:
   - `/api/freight-orders/poll/route.ts` - Now includes all items with `isDiscount` flag and `customAttributes`
   - `/api/webhook/shipstation/route.ts` - Includes discount data in order notifications
   - Items are no longer filtered out based on discount status

2. **Enhanced Worker View Display** (`InspectionScreen.tsx`):
   - Shows discount items with yellow "DISCOUNT" badge
   - Displays discount amounts in green with dollar values
   - Calculates and shows total discount applied at bottom of items list
   - Properly handles undefined values to prevent display errors

3. **Type Definitions Updated** (`lib/types/worker-view.ts`):
   - Added `isDiscount?: boolean` to identify discount items
   - Added `customAttributes?: Array` for custom ShipStation attributes
   - Updated both `InspectionScreenProps` and `WorkspaceData` types

**Benefits**:
- Workers have full visibility of order discounts during inspection
- Automatic detection of discount items (name containing "discount", negative price, or discount line item keys)
- Clean display that only shows discount information when it exists
- No errors when viewing demo/test orders without discount data

### Database and QR Code System Cleanup (January 12, 2025)
**Problem**: Order #36311 was showing incorrect label count (6 instead of 3) due to database inconsistencies and redundant schema columns.

**Solution Implemented**:
1. **Database Reset** - Created scripts to clear all data and start fresh:
   - `scripts/reset-database.ts` - Clears all tables safely
   - `scripts/check-qr-codes.ts` - Diagnostic tool for QR code inspection
2. **Schema Simplification** - Removed confusing/redundant columns:
   - Removed `master_qr_id`, `container_qr_ids` (QR codes tracked in separate table)
   - Removed `qr_generation_rule` (never used)
   - Removed `shipstation_order_id` (redundant with `order_id`)
   - Removed `s3_bucket_name` (documents table has this)
3. **Fixed QR Generation Logic** - Corrected container count calculation for different product types

**Result**: Clean, simplified schema with accurate QR code generation (1 master + 1 source + N containers based on actual order items).

### QR Code Generation and Label Printing System Overhaul (January 12, 2025)

#### Phase 1: Fixed Data Integrity in QR Generation
**Problem**: Duplicate QR codes were being created on repeated API calls, and labels were missing critical product information.

**Solution Implemented**:
1. **Idempotent QR Generation** (`app/api/workspace/[orderId]/qrcodes/route.ts`):
   - QR codes are now only created if they don't already exist
   - Each order item is tracked individually with proper container count logic
   - Chemical names and total container counts are properly saved in the database
   - Smart container logic: drums (1:1), totes (1:1), pails (36:1 pallet), boxes (144:1 pallet)

2. **Database Schema Cleanup**:
   - Created `scripts/reset-database.ts` - Safely clears all tables
   - Created `scripts/check-qr-codes.ts` - Diagnostic tool for QR inspection
   - Removed redundant columns: `master_qr_id`, `container_qr_ids`, `qr_generation_rule`, `shipstation_order_id`, `s3_bucket_name`

#### Phase 2: Professional Label Design and Layout
**Problem**: Labels had overlapping text, orphaned elements across pages, and inconsistent layouts between label types.

**Solution Implemented**:
1. **Standardized HTML Structure** (`app/api/qr/print/route.ts`):
   - Single consistent template for all label types (master, source, container)
   - Clean helper functions: `getLabelType()`, `getProductName()`, `getItemInfo()`
   - Proper data display with fallbacks for missing information

2. **Robust CSS with Flexbox**:
   - Used `justify-content: space-between` for proper vertical distribution
   - Eliminated page-breaking issues that caused orphaned elements
   - Consistent professional appearance across all label types
   - Optimized text sizes for 4x6" thermal labels:
     - Order number: 18pt
     - Product name: 20pt
     - Item info: 14pt
     - Short code: 24pt
     - QR code: 2.2in × 2.2in

#### Phase 3: Production Deployment and Vercel Compatibility
**Problem**: QR codes linked to localhost; PDF generation failed on Vercel's serverless environment due to missing Playwright binaries.

**Solution Implemented**:
1. **Production URL Configuration**:
   - Updated QR generation to use `https://order-management-kappa-seven.vercel.app`
   - Set `NEXT_PUBLIC_APP_URL` environment variable in Vercel
   - QR codes now correctly link to production workspace pages

2. **Dual-Mode PDF Generation**:
   - Local development: Uses Playwright (faster, simpler setup)
   - Vercel production: Uses puppeteer-core with @sparticuz/chromium (serverless-compatible)
   - Auto-detects environment using `process.env.VERCEL`
   - Seamless switching with no code changes needed

**Professional Label Format**:
```
┌─────────────────────────┐
│   Order #67890          │
│   [SCAN AT START]       │
│                         │
│   MASTER LABEL          │
│                         │
│      ████ ██ ███        │
│      █ ██ █ █ █         │
│      ████ ██ ███        │
│                         │
│                         │
│    SCAN CODE            │
│    [ 3FKQ16 ]           │
│  Scan QR or enter code  │
└─────────────────────────┘
```

**Result**: Production-ready system with:
- Proper data integrity and duplicate prevention
- Professional label formatting suitable for warehouse use
- Reliable PDF generation in both local and cloud environments
- Correct production URLs for all QR codes
- 3-page PDF output (one label per page, no orphaned elements)

### Label Content Integrity Fix (January 12, 2025)
**Problem**: Destination container labels were incorrectly showing source information, causing confusion on the warehouse floor.

**Solution Implemented**:
1. **Refactored Label Helper Functions** (`app/api/qr/print/route.ts`):
   - Each label type now only displays information about itself
   - Source labels show: Order #, "SCAN AT SOURCE", "SOURCE CONTAINER", Chemical name
   - Container labels show: Order #, Chemical name, "Drum X of Y" (no source info)
   - Master labels show: Order #, "SCAN AT START", "MASTER LABEL"

2. **Fixed QR Code Ordering**:
   - Master QR always appears first in the list
   - Source QR appears second
   - Container QRs follow after
   - Added SQL ORDER BY clause to ensure consistent ordering

3. **Source Container Selector Improvements**:
   - Made Source Container ID optional
   - Search dropdown closes when product is selected
   - Auto-generates ID using product ID and container size when no ID provided

**Result**: Clear, unambiguous labels where each label only describes the physical object it's attached to.

### QR Generation and Label Printing Bug Fixes (January 13, 2025)
**Problems Addressed**:
1. Source container labels incorrectly listing all chemicals from the order
2. Container numbering showing impossible values (e.g., "Drum 2 of 1", "Pallet 3 of 1")
3. Missing "SCAN TO INSPECT" badges on direct resell container labels

**Solution Implemented**:
1. **Fixed QR Generation Logic** (`app/api/workspace/[orderId]/qrcodes/route.ts`):
   - Source QR now generates with generic "Source Container" name instead of concatenating all chemicals
   - Fixed container numbering by properly tracking per-item container counts
   - Each item's containers now correctly numbered (e.g., "Pallet 1 of 1" for 6 pails on 1 pallet)
   - Separated global container index from per-item numbering for database integrity

2. **Enhanced Label Assignment Matching** (`app/api/qr/print/route.ts`):
   - Improved `findSourceAssignment` function with multi-fallback matching:
     - Primary: Match by lineItemId (most reliable)
     - Secondary: Match by SKU
     - Tertiary: Enhanced bidirectional product name matching
   - Added debugging logs for troubleshooting label generation

**Result**: Accurate container numbering, correct source labels, and proper workflow-specific badges on all label types.

## Chemical Dilution Calculator with Container Linking (Updated January 13, 2025)

### Overview
Implemented a sophisticated dilution calculator that helps supervisors determine precise chemical-to-water ratios when source concentrations exceed target concentrations. The system supports v/v%, w/v%, and w/w% calculation methods with full PostgreSQL database integration. **NEW**: Dilution batches are now digitally linked to destination containers without creating additional QR codes, and includes an elegant PDF printing feature.

### Features
1. **Automatic Dilution Detection** (`PrintPreparationModal`)
   - Compares source concentration vs target concentration
   - Shows orange warning when dilution is required (e.g., 12.5% → 10%)
   - Provides "Calculate Dilution →" button that opens calculator with pre-filled values
   - **NEW**: Passes destination container QR codes to link dilution to specific containers

2. **Dilution Calculator Page** (`/dilution-calculator`)
   - **Enhanced Chemical Database**: 100+ chemicals from API with Shopify product linking
   - **Safety Features**: Critical safety warnings, specific gravity verification
   - Three calculation methods: Volume/Volume, Weight/Volume, Weight/Weight
   - Unit conversion support (gallons/liters)
   - Real-time visual mixture representation
   - Batch number generation and tracking
   - **NEW**: Shows destination containers that will receive the diluted chemical

3. **Database Integration** (`batch_history` table)
   - Permanent storage of all dilution operations
   - **NEW**: `destinationQrIds` field links batches to specific destination containers
   - Complete audit trail with operator names and timestamps
   - Searchable history with CSV export functionality
   - **NO NEW QR CODES**: Dilution batches link to existing container QRs

4. **Elegant PDF Printing** (`/api/batches/print`)
   - Professional dilution record with gradient headers
   - Visual concentration change display (12.5% → 10%)
   - Color-coded volume bars showing chemical/water ratios
   - Safety reminders and PPE requirements
   - Signature lines for quality check and supervisor approval
   - Linked destination containers listed on report

5. **Integration Points**
   - **Launch from Source Assignment**: When supervisor assigns 12.5% source for 10% target
   - **Parameters Passed**: Chemical name, concentrations, volume, destination QR codes
   - **Return Navigation**: After saving batch, returns to calling page
   - **Container Linking**: Batch digitally linked to destination containers for traceability

### Workflow
1. Supervisor assigns source container in PrintPreparationModal
2. System detects concentration mismatch (source > target)
3. Orange warning appears with "Calculate Dilution" button
4. Calculator opens with pre-filled values and destination container QR codes
5. Supervisor enters total volume needed
6. System calculates exact chemical and water amounts
7. Batch is saved to database with links to destination containers
8. Elegant PDF can be printed for physical documentation
9. Returns to order with dilution batch linked to containers

### Benefits
- **Precision**: Accurate dilution calculations considering specific gravity
- **Safety**: PPE recommendations and hazard classifications displayed
- **Traceability**: Every dilution tracked with batch numbers and QR codes
- **Efficiency**: Pre-filled values and quick templates speed up common dilutions
- **Compliance**: Complete audit trail for regulatory requirements

## Source QR Code Duplicate Prevention (January 13, 2025)

### Overview
Implemented a robust database-level constraint system to prevent race conditions when multiple users simultaneously create source QR codes for the same container. This solution uses a unique partial index on the PostgreSQL database to ensure data integrity.

### Technical Implementation

#### Database Schema Changes
- **Added `source_container_id` column** to `qr_codes` table (varchar(255))
- **Created unique partial index**: Prevents duplicate source QRs for the same container
  ```sql
  CREATE UNIQUE INDEX "idx_unique_source_qr" 
  ON "qr_workspace"."qr_codes" ("workspace_id", "source_container_id")
  WHERE "qr_type" = 'source' AND "source_container_id" IS NOT NULL;
  ```

#### API Error Handling (`/api/workspace/[orderId]/assign-source`)
- Gracefully handles unique constraint violations (PostgreSQL error code '23505')
- When race condition detected, silently proceeds (another process already created the QR)
- Logs race condition events for monitoring
- Non-constraint errors are properly re-thrown

### Benefits
- **Race Condition Prevention**: Database enforces uniqueness at the lowest level
- **Data Integrity**: Impossible to create duplicate source QRs even under high concurrency
- **Clean Architecture**: Constraint is part of the schema, not application logic
- **Graceful Handling**: Users experience no errors during simultaneous operations
- **Audit Trail**: All attempts are logged for debugging

### Migration Strategy
The solution was implemented using Drizzle ORM's migration system:
1. Added `source_container_id` to the schema definition
2. Generated a clean migration file with `drizzle-kit generate`
3. Enhanced migration with data backfill from existing JSONB fields
4. Applied changes using standard migration tooling
5. All changes are version-controlled in `/drizzle` directory

## Hybrid Order Workflows - Per-Item Fulfillment Methods (January 13, 2025)

### Overview
Implemented a sophisticated hybrid workflow system that allows supervisors to specify fulfillment methods (Pump & Fill or Direct Resell) for each individual line item within a single order. This enables complex orders where some items are transferred from bulk sources while others are shipped as pre-packaged containers.

### Key Features

#### 1. Per-Item Workflow Control
- **Individual Assignment**: Each line item can be independently set as `pump_and_fill` or `direct_resell`
- **Visual Toggles**: Clean UI with distinct color coding (blue for Pump & Fill, green for Direct Resell)
- **Dynamic Requirements**: Only pump & fill items require source container assignment
- **Smart Validation**: Print button disabled until all pump & fill items have sources assigned

#### 2. Updated Data Structure
- **Enhanced sourceAssignments**: Now includes `workflowType` field for each line item
- **API Updates**: `/api/workspace/[orderId]/assign-source` handles workflow types
- **Flexible Storage**: Direct resell items store empty sourceContainers array

#### 3. Adaptive Label Printing
- **Mixed Label Types**: Single print job produces appropriate labels for each workflow
- **Direct Resell Labels**: Get "SCAN TO INSPECT" badge instead of source requirements
- **Pump & Fill Labels**: Show standard container numbering and source information
- **Smart QR Filtering**: Source QR only included if at least one item is pump & fill

#### 4. Worker Mobile View Enhancements
- **Dynamic Inspection Steps**: Source scanning steps only appear for pump & fill items
- **Visual Indicators**: Direct resell items show green "No source scan needed" message
- **Mixed Order Support**: Workers see appropriate workflow for each scanned container
- **Intelligent Source Display**: Only shows source containers for pump & fill items

### Implementation Details

#### Backend Changes
```typescript
// Updated sourceAssignment structure
{
  lineItemId: string,
  productName: string,
  quantity: number,
  workflowType: 'pump_and_fill' | 'direct_resell',
  sourceContainers: Array<{ id: string, name: string }>
}
```

#### UI Components
- **PrintPreparationModal**: Redesigned with per-item workflow toggles
- **InspectionScreen**: Dynamically adjusts based on item workflows
- **Label Printing**: Adapts label content based on workflowType

### Workflow Example
1. **Supervisor opens order** with 3 items: 2 chemicals and 1 pre-packaged product
2. **Assigns workflows**: Sets chemicals to "Pump & Fill", pre-packaged to "Direct Resell"
3. **Source assignment**: Selects source containers only for pump & fill items
4. **Label printing**: Generates mixed labels - source-aware for chemicals, direct for pre-packaged
5. **Worker inspection**: Sees source requirements only for pump & fill items

### Benefits
- **Flexibility**: Support complex orders with mixed fulfillment methods
- **Efficiency**: Skip unnecessary steps for pre-packaged items
- **Clarity**: Workers immediately understand requirements for each item
- **Accuracy**: Reduced errors through workflow-specific validation
- **Scalability**: Easy to add new workflow types in the future

Future Improvements
This section outlines planned enhancements to the Workspace Order Management System, categorized by focus area.
🚀 Core Application & UX
Full User Authentication & Role-Based Access: Implement a robust authentication system to replace the development middleware, ensuring that views and actions are restricted based on user roles (e.g., automatically showing the Worker View for 'operator' roles).
Offline Mode: Add service worker support to allow workers to perform and save inspections even when their device loses network connectivity, with automatic syncing upon reconnection.
Real-time Collaboration Indicators: Enhance the current_users feature to display a live indicator on a module when another user is actively working on it, preventing concurrent edits.
UI Skeletons & Optimistic Updates: Implement loading skeletons for a smoother initial page load and use optimistic UI updates for instantaneous feedback when a worker performs an action.

🧪 Testing & Operations (Remaining)
Fix Full Order Workflow Tests: Align test data structure with current database schema to enable comprehensive workflow testing.
Consolidate Serverless Logic: Remove the legacy /lambda directory to eliminate confusion and ensure all backend logic resides exclusively in the Next.js app/api routes, leveraging Vercel Serverless Functions.
Robust Error Monitoring: Integrate a monitoring service like Sentry to capture and report on frontend and backend errors in real-time.