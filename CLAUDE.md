# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server with TurboPack on port 3000
- `npm run dev:test` - Start test development server on port 3003
- `npm run build` - Build production application
- `npm run lint` - Run Next.js linting

### Database
- `npm run db:push` - Push schema changes to database (uses Drizzle Kit)
- `npm run db:migrate` - Generate database migrations
- `npm run db:studio` - Open Drizzle Studio for database management
- `npm run reset-db` - Reset database with fresh schema
- `npm run clear-db -- --force` - Clear all database data (requires --force flag for safety)

### Testing
- `npm test` - Run unit tests with Vitest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm run test:e2e` - Run Playwright E2E tests
- `npm run test:e2e:ui` - Run E2E tests with UI
- To run a single test file: `npm test -- path/to/test.ts`

### Deployment
- `vercel --prod` - Deploy to production
- `./set-vercel-env.sh` - Set Vercel environment variables
- Always run `npm run lint` and `npm run build` before deploying

## Architecture

### Core Stack
- **Next.js 15.4.6** with App Router and TypeScript
- **PostgreSQL** with **Drizzle ORM** for database operations
- **Tailwind CSS v3** for styling
- **React Query (TanStack Query)** for data fetching and caching
- **Zustand** for client-side state management

### Database Architecture
The application uses PostgreSQL with two schemas:
- `qr_workspace` - Main application schema containing workspaces, QR codes, inspections, documents, activities
- `auth` - Authentication schema managed by better-auth

Key tables in `lib/db/schema/qr-workspace.ts`:
- `workspaces` - Central entity tracking orders with ShipStation integration
- `qrCodes` - QR code management for source/destination containers and master labels
- `inspections` - Pre-mix and pre-ship inspection records
- `sourceContainers` - Bulk container inventory tracking
- `documents` - Document storage with S3 integration
- `activities` - Audit log of all workspace actions

### Application Structure

#### Dual Interface System
The app provides two distinct interfaces for different user roles:

1. **Worker View** (`/components/workspace/agent-view/`)
   - Touch-optimized interface for warehouse floor
   - One-item-at-a-time inspection workflow
   - **ResilientInspectionScreen**: Enhanced inspection interface with fallback mechanisms
   - QR scanning with camera integration and manual code entry fallback
   - Voice-to-text issue reporting
   - Supervisor override request system for problematic steps
   - Offline queue with automatic retry on reconnection

2. **Supervisor View** (`/components/workspace/supervisor-view/`)
   - Full management interface
   - Source container assignment
   - Label printing and document management
   - Complete order overview

#### API Routes (`/app/api/`)
- `/workspace/[orderId]/` - Main workspace operations (CRUD, activity tracking, QR generation)
- `/shipstation/` - ShipStation webhook and order synchronization
- `/qr/` - QR code generation, scanning, and printing
- `/ai/` - AI services for anomaly detection, OCR, and issue analysis
- `/documents/` - Document upload and management with S3

#### Service Layer (`/lib/services/`)
- `workspace/service.ts` - Core business logic for workspace operations
- `shipstation/client.ts` - ShipStation API integration
- `qr/generator.ts` - QR code generation and URL encoding
- `qr/validation.ts` - QR code validation service with type checking and error recovery
- `ai/gemini-service.ts` - Google Gemini AI integration
- `offline/inspection-queue.ts` - Offline inspection queue management with retry logic
- `supervisor-override.ts` - Supervisor override request handling

### Key Workflows

#### Order Processing Flow
1. Order syncs from ShipStation via webhook or manual creation
2. Workspace created with unique URL `/workspace/{orderId}`
3. QR codes generated for containers and master labels
4. Source containers assigned based on workflow type (pump_and_fill or direct_resell)
5. Pre-mix inspection performed with QR verification
6. Pre-ship inspection validates final packaging
7. Order marked as shipped and archived after 30 days

#### QR Code System
- **Source QR**: Links to bulk chemical containers
  - Shows chemical name prominently with container type (275 GAL TOTE, etc)
  - Orange "SOURCE BULK" badge for clear identification
  - "FILLS INTO → Customer Order Containers" instruction
- **Destination QR**: Applied to individual order containers
  - "TO BE FILLED" badge for pump_and_fill items
  - Shows "← FILL FROM SOURCE" with specific source container info
  - Container numbering (1 of 3, etc)
- **Master Label QR**: Contains full order information
  - "ORDER MASTER" badge
  - Shows all order items in bordered "ORDER CONTAINS" section
- **Direct Resell Items**: Pre-packaged items ready to ship
  - "READY TO SHIP" badge
  - "✓ Pre-packaged" indicator
- URLs encode workspace ID, order details, and container info
- All QR codes tracked with scan counts and history
- **Short codes**: 6-8 character alphanumeric codes for manual entry fallback
- **ValidatedQRScanner**: Resilient scanner with automatic validation and manual entry support

### External Integrations

#### ShipStation
- Real-time order synchronization via webhooks
- Order tags determine workflow type (freight orders, ready-to-ship)
- API credentials required in environment variables

#### AWS Services
- **S3**: Document and image storage
- **SQS**: Async processing for QR generation and alerts
- **SNS**: Supervisor notifications for critical events

#### Google Gemini AI
- Document OCR for automated data extraction
- Anomaly detection in inspection data
- Voice-to-text processing for issue reports

### Testing Strategy
- Unit tests with Vitest for services and utilities
- Component tests for React components
- E2E tests with Playwright covering critical workflows
- Test data isolation using separate database schemas

### Environment Configuration
Required environment variables in `.env.local`:
- `DATABASE_URL` - PostgreSQL connection string
- `SHIPSTATION_API_KEY/SECRET` - ShipStation credentials
- `AWS_ACCESS_KEY_ID/SECRET` - AWS credentials
- `S3_BUCKET_NAME` - Document storage bucket
- `NEXT_PUBLIC_APP_URL` - Production URL for QR codes

### Development Guidelines
- Use existing UI components from `/components/ui/`
- Follow the established pattern for API routes with proper error handling
- Maintain separation between worker and supervisor views
- Use React Query for all data fetching operations
- Store workspace state in Zustand store
- Log all significant actions to the activity timeline
- Validate QR codes before processing
- Handle ShipStation webhook events idempotently

### QR Label Generation
- Labels generated via `/api/qr/print/route.ts` and `/api/source-containers/print-labels/route.ts`
- Source container names can be in formats:
  - `"tote275 #ABC123"` - Container type with code
  - `"tote275 #- ChemicalName"` - Container with chemical name
  - Parse carefully to extract chemical name and container info correctly
- Always ensure source labels show the actual chemical name, not generic text
- Destination labels must clearly show what source to fill from

## Edge Cases to Test

### QR Code Scanning
- **Out-of-order scanning**: System should guide user to correct sequence or allow skip with supervisor override
- **Wrong QR type**: Scanning destination QR when source is expected should show clear error message with suggestions
- **Invalid/expired QR**: Handle gracefully with user-friendly error and retry option
- **Duplicate scans**: Prevent double-processing of same QR code
- **Camera failures**: Automatic fallback to manual short code entry
- **Manual code validation**: Validate short codes match expected format and order context

### Network Reliability
- **Connection drops during inspection**: Cache inspection progress locally, auto-resume when reconnected
- **API timeout during submission**: Implement retry logic with exponential backoff
- **Partial data sync**: Queue failed operations for retry, show sync status indicator
- **Offline mode**: Allow read-only access to cached data, queue writes for later

### Data Integrity
- **Concurrent edits**: Handle multiple users in same workspace with optimistic updates
- **Race conditions**: Source container assignment should use database locks
- **Webhook duplicates**: ShipStation webhooks must be idempotent
- **Archive timing**: Ensure 30-day archive doesn't lose active inspections

### User Errors
- **Wrong container selected**: Allow undo/correction before final submission
- **Accidental navigation**: Confirm before leaving incomplete inspection
- **Mixed workflow types**: Validate pump_and_fill vs direct_resell consistency
- **Permission boundaries**: Worker view changes shouldn't affect supervisor-only data