# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application for Alliance Chemical's chemical logistics and freight management system. It provides QR code-based workspace management, chemical dilution tracking, inspection workflows, and AI-powered freight classification.

## Core Development Commands

**Build & Development:**
```bash
npm run dev                    # Start development server
npm run build                  # Build for production
npm run start                  # Start production server
npm run lint                   # Run ESLint (with plugin disabled)
```

**Database Operations:**
```bash
npm run db:push               # Push schema changes to database
npm run db:migrate            # Run database migrations
npm run db:studio             # Open Drizzle Studio
npm run db:init               # Initialize database
npm run reset-db              # Reset database completely
```

**Testing:**
```bash
npm run test                  # Run unit tests with Vitest
npm run test:ui               # Run tests with UI
npm run test:run              # Run tests once
npm run test:coverage         # Run tests with coverage
npm run test:e2e              # Run Playwright E2E tests
npm run test:e2e:ui           # Run E2E tests with UI
npm run test:e2e:debug        # Debug E2E tests
```

**Demo & Data Management:**
```bash
npm run demo:seed             # Seed demo data
npm run demo:cleanup          # Clean demo data
npm run demo:reset            # Reset and reseed demo data
```

## Architecture Overview

### Database Schema (Drizzle ORM)
- **Primary Schema:** `lib/db/schema/qr-workspace.ts` - Core workspace, QR codes, documents, alerts
- **Freight Schema:** `lib/db/schema/freight.ts` - Freight orders, quotes, events, chemical products
- **RAG Schema:** `lib/db/schema/rag-embeddings.ts` - AI embeddings for hazmat classification

### Key Application Structure

**App Router (Next.js 15):**
- `/app/page.tsx` - Main work queue dashboard
- `/app/workspace/[orderId]/` - Individual workspace pages
- `/app/api/` - API routes for backend operations

**Core Components:**
- `/components/workspace/` - Workspace-specific components
- `/components/inspection/` - Inspection and photo capture
- `/components/qr/` - QR code scanning and management
- `/components/ui/` - Shared UI components (Radix + Tailwind)

**Services Layer:**
- `/lib/services/` - Business logic services
- `/lib/services/ai/` - AI integration (Gemini)
- `/lib/services/qr/` - QR code generation and validation
- `/lib/services/workspace/` - Workspace management

### Key Features

**QR Code System:**
- Generates unique QR codes for chemical containers
- Links to workspace management interfaces
- Supports both short codes and full URLs

**Workspace Management:**
- Order-based workspaces linked to ShipStation
- Module-based workflow (PreMix, Warehouse, Documents, Freight)
- Real-time collaboration and status tracking

**Chemical Dilution System:**
- Concentration calculations (v/v, w/v, w/w methods)
- Batch history tracking with specific gravity
- Container type management linked to Shopify

**Freight & Classification:**
- AI-powered freight class determination
- MyCarrier integration for shipping
- NMFC code and hazmat classification

**Inspection Workflows:**
- Photo capture with metadata
- Pre-shipment inspection checklists
- Container and measurement tracking

## Environment & Configuration

**Required Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `VERCEL_KV_*` - Vercel KV store credentials
- `AWS_*` - AWS services (S3, SNS, SQS)
- `GOOGLE_GEMINI_API_KEY` - AI service

**Key Config Files:**
- `drizzle.config.ts` - Database configuration
- `next.config.ts` - Next.js with PWA support
- `tailwind.config.js` - Warehouse-optimized design system
- `vitest.config.ts` - Testing configuration

## Design System

The application uses a warehouse-optimized design system:
- **Colors:** High-contrast WCAG AAA compliant colors
- **Typography:** Large, glove-friendly text sizes
- **Touch Targets:** Minimum 60px for gloved hands
- **Animations:** Physical button press effects and loading states

## AI & Machine Learning

**Gemini Integration:**
- Chemical classification and freight determination
- Document OCR and anomaly detection
- RAG (Retrieval Augmented Generation) for hazmat data

**RAG System:**
- CFR (Code of Federal Regulations) embeddings
- ERG (Emergency Response Guide) data
- Product classification database

## Testing Strategy

**Unit Tests:** Vitest with React Testing Library
**E2E Tests:** Playwright for full workflow testing
**Environment-Specific:** Different configs for API vs component tests

## Deployment

**Platform:** Vercel
**Database:** Neon PostgreSQL
**Storage:** AWS S3
**Caching:** Vercel KV

**Build Notes:**
- ESLint disabled during builds (compatibility)
- TypeScript errors ignored for deployment
- PWA can be disabled with `DISABLE_PWA=true`

## Common Patterns

**Database Operations:**
- Use Drizzle ORM with prepared statements
- All timestamps in UTC
- JSON columns for flexible metadata

**Component Development:**
- Server Components by default
- Client Components marked with 'use client'
- Shared UI components in `/components/ui/`

**API Routes:**
- Next.js App Router API format
- Error handling with proper HTTP status codes
- Database transactions for data integrity

**State Management:**
- Zustand for client state
- SWR for server state caching
- React Query for API data fetching