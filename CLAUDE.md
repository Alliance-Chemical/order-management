Project Phoenix: QR-Based Order Workspace System
Version: 2.1
Last Updated: January 13, 2025
Production URL: https://order-management-kappa-seven.vercel.app
Status: Core features complete. Authentication implemented. Test coverage in progress.
1. Core Mission & Purpose
This system is designed to eliminate errors and create a complete digital audit trail for the chemical fulfillment process. It solves two primary business problems:
Preventing Errors: Pumping the wrong chemical, using the wrong grade, or shipping the wrong pre-packaged goods.
Creating Traceability: Moving from a verbal/paper-based system to a fully digital, real-time tracking system for every order and its components.
The core principle is a desktop-first preparation workflow that feeds a mobile-first, foolproof execution workflow on the warehouse floor.
2. System Architecture & Tech Stack
Framework: Next.js 15 (App Router) with Turbopack
Authentication: Better Auth v1.3.5 with Drizzle adapter
Deployment: Vercel (Frontend & Serverless Functions), AWS (Services)
Database: PostgreSQL (hosted on Neon) with Drizzle ORM
Backend: Next.js API Routes (app/api), AWS S3, SQS, SNS
AI Services: Google Gemini 1.5 Flash (Vision, Speech-to-Text, Analysis)
Styling: Tailwind CSS
Language: TypeScript
3. The End-to-End "Golden Path" Workflow
This is the primary user journey, designed to be robust and intuitive.
Order Ingestion (Automated): A ShipStation webhook automatically creates a "Workspace" when an order is tagged for freight processing.
Preparation (Desktop - Supervisor):
A supervisor views the Work Queue Dashboard (/) to see available orders.
They select an order, opening the Order Assignment Modal.
For each line item, they choose a workflow:
Pump & Fill: They are required to assign a specific, QR-coded Source Container from inventory. If the source concentration is higher than the target, a Dilution Calculator is presented.
Direct Resell: The item is marked as ready, requiring no source.
Once all items are assigned, they click "Print All Labels". A PDF with unique, informative 4x6" labels for the Master, Source(s), and Destination containers is generated.
Execution (Mobile - Worker):
A worker takes the printed labels and a mobile device to the floor.
They scan the Master QR to open the Worker View Task List.
The task list is prioritized, showing "Pump & Fill" items first.
The worker selects an item to begin its specific inspection flow.
The app guides them through scanning the correct Source and Destination QRs, ensuring a perfect physical-to-digital match.
If issues arise, they can use the AI Issue Reporter (voice/photo) instead of typing.
Completion: Once all items are inspected, the order's status is updated, and a complete digital audit trail is available in the activity_log.
4. Key Features & Modules
Desktop Supervisor Experience
Work Queue Dashboard (/): Live-updating list of all freight orders from ShipStation.
Order Assignment Modal: The central command center for preparing an order.
Hybrid Workflow Control: Per-item selection of "Pump & Fill" vs. "Direct Resell".
Source Container Selector: A searchable interface to link bulk inventory to order items.
Grade Mismatch Warning: An automated safety check that alerts the supervisor if the source grade (e.g., Tech) is incompatible with the required destination grade (e.g., Food Grade).
Dilution Calculator (/dilution-calculator):
A standalone tool, seamlessly integrated into the assignment workflow.
Uses a database of verified chemical data to calculate precise mixing ratios.
Saves a permanent batch_history record linked to the destination containers.
Generates an elegant, printable PDF worksheet for each batch.
Anomaly Dashboard (/anomaly-dashboard): An AI-powered dashboard that analyzes historical data to find hidden risk patterns and high-risk product/customer combinations.
Mobile Worker Experience
Task List UI: An interactive to-do list for multi-item orders, allowing workers to choose their next task.
Guided Inspection Flow: A step-by-step process with large, high-contrast UI elements.
Integrated QR Scanner: The camera is used to verify source and destination containers at the appropriate steps.
"Auto-Skip" Logic: The app intelligently skips unnecessary steps (like source scanning for "Direct Resell" items) to streamline the process.
Backend & Data Systems
Database Schema (/lib/db/schema): A clean, normalized PostgreSQL schema with tables for workspaces, items, source containers, products, batch history, QR codes, and activity.
On-Demand QR Generation: A robust system that creates and links QR codes for all entities as needed, with a unique, partial index to prevent duplicate source QRs.
Professional PDF Label Generation: A Vercel-compatible service that creates informative 4x6" labels with human-readable data (Order #, Chemical Name, Container #) and instructional badges ("SCAN AT START").
AI Services (/lib/services/ai): A dedicated service layer for all Google Gemini integrations (OCR, Voice-to-Text, Vision Analysis, Pattern Detection).
5. Development & Testing
Database Management (Drizzle Kit)
Generate Migrations: npm run db:migrate
Apply Migrations: npm run db:push
View Database: npm run db:studio
Testing Suite
The project uses a comprehensive testing framework. All tests run against a separate test database defined in .env.test.
End-to-End Tests (Playwright): Located in /tests/e2e/.
simple-workflow.spec.ts: Tests basic navigation and view switching. (All Passing)
full-order-workflow.spec.ts: Simulates the entire "Golden Path" workflow. (WIP - Needs schema alignment)
Unit & Integration Tests (Vitest): To be added for services and API routes.
Run E2E Tests:
code
Bash
# Run all E2E tests headless
npm run test:e2e

# Run tests in UI mode for debugging
npm run test:e2e:ui
This revised document provides a complete, high-level overview of the entire system as it stands today. It's the perfect guide for anyone joining the project and a great reference for future development.|

/home/andre/my-app/app
/home/andre/my-app/app/anomaly-dashboard
/home/andre/my-app/app/api
/home/andre/my-app/app/api/activity
/home/andre/my-app/app/api/ai
/home/andre/my-app/app/api/auth
/home/andre/my-app/app/api/batches
/home/andre/my-app/app/api/chemicals
/home/andre/my-app/app/api/debug
/home/andre/my-app/app/api/documents
/home/andre/my-app/app/api/freight-orders
/home/andre/my-app/app/api/qr
/home/andre/my-app/app/api/shipstation
/home/andre/my-app/app/api/shopify
/home/andre/my-app/app/api/source-containers
/home/andre/my-app/app/api/webhook
/home/andre/my-app/app/api/workspace
/home/andre/my-app/app/dilution-calculator
/home/andre/my-app/app/freight-orders
/home/andre/my-app/app/login
/home/andre/my-app/app/workspace
/home/andre/my-app/app/globals.css
/home/andre/my-app/app/layout.tsx
/home/andre/my-app/app/page.tsx
/home/andre/my-app/components
/home/andre/my-app/data
/home/andre/my-app/drizzle
/home/andre/my-app/lib
/home/andre/my-app/middleware
/home/andre/my-app/node_modules
/home/andre/my-app/playwright-report
/home/andre/my-app/public
/home/andre/my-app/scripts
/home/andre/my-app/terraform
/home/andre/my-app/test-results
/home/andre/my-app/tests
/home/andre/my-app/.env.example
/home/andre/my-app/.env.local
/home/andre/my-app/.env.production
/home/andre/my-app/.env.test
/home/andre/my-app/.gitignore
/home/andre/my-app/.vercelignore
/home/andre/my-app/CLAUDE.md
/home/andre/my-app/deploy-to-vercel.sh
/home/andre/my-app/DEPLOYMENT.md
/home/andre/my-app/drizzle.config.ts
/home/andre/my-app/enhanced-labels.pdf
/home/andre/my-app/env.local
/home/andre/my-app/eslint.config.mjs
/home/andre/my-app/middleware.ts
/home/andre/my-app/next-env.d.ts
/home/andre/my-app/next.config.ts
/home/andre/my-app/package-lock.json
/home/andre/my-app/package.json
/home/andre/my-app/playwright.config.ts
/home/andre/my-app/postcss.config.mjs
/home/andre/my-app/push-to-github.sh
/home/andre/my-app/README.md
/home/andre/my-app/set-vercel-env.sh
/home/andre/my-app/tailwind.config.js
/home/andre/my-app/test-dual-mode.pdf
/home/andre/my-app/test-labels-fixed.pdf
/home/andre/my-app/test-labels-smaller-text.pdf
/home/andre/my-app/test-labels.pdf
/home/andre/my-app/test-shipstation-webhook.js
/home/andre/my-app/TESTING.md
/home/andre/my-app/tsconfig.json
/home/andre/my-app/update-shipstation-env.sh
/home/andre/my-app/vercel.json
/home/andre/my-app/vitest.config.ts
/home/andre/my-app/WORKER-VIEW-IMPLEMENTATION.md


Future Improvements
The core feature set for the QR Workspace System is complete. The next phase of development will focus on hardening the application for production use, improving the user experience, and ensuring long-term maintainability.

🚀 Priority 1: Hardening for Production
✅ Full User Authentication & Role-Based Access:
Status: COMPLETED (January 13, 2025)
Implementation: Better Auth v1.3.5 with Drizzle adapter
Features: Email/password authentication, role-based access (worker/supervisor), 30-day sessions, middleware protection
Files: /lib/auth.ts, /lib/auth-client.ts, /app/login/page.tsx, /middleware.ts
Bulk User Creation Script: /scripts/seed-users.ts for easy onboarding
✅ Comprehensive Test Coverage:
Status: PARTIALLY COMPLETED (January 13, 2025)
Implementation: 
- Fixed simple-workflow.spec.ts tests (passing)
- Fixed source-containers.spec.ts tests (passing)
- Created test data seeding scripts
- Auth middleware configured for test bypass
- 10/12 E2E tests passing
Remaining: Fix full-order-workflow.spec.ts, add unit/integration tests
✅ Robust Error Monitoring & Logging:
Status: COMPLETED (January 13, 2025)
Implementation: Sentry integration with Next.js
Features:
- Client, server, and edge error tracking
- Custom error boundaries and API error handlers
- Request ID tracking for debugging
- Performance monitoring (10% sample rate in production)
- Session replay on errors
- Test endpoint at /api/test-error
Files: sentry.*.config.ts, /lib/error-handler.ts, /app/error.tsx
🌟 Priority 2: Enhancing the User Experience
✅ UI Skeletons & Optimistic Updates:
Status: COMPLETED (January 13, 2025)
Implementation: React Query with custom hooks and skeleton components
Features:
- Loading skeleton components for all major UI elements
- Optimistic update hook with automatic rollback on error
- React Query integration with 30s stale time
- Query caching and background refetching
- Dev tools for debugging in development
Files: /components/skeletons/*, /hooks/useOptimisticUpdate.ts, /providers/QueryProvider.tsx
✅ Real-time Collaboration Indicators:
Status: COMPLETED (January 13, 2025)
Implementation: Server-Sent Events (SSE) with collaboration service
Features:
- Real-time user presence tracking
- Activity status updates (viewing, editing, inspecting)
- Role-based indicators (worker/supervisor)
- Automatic cleanup of inactive users
- Visual badges on dashboard
Files: /lib/services/collaboration.ts, /hooks/useCollaboration.ts, /components/CollaborationIndicator.tsx

✅ Offline Mode (Progressive Web App - PWA):
Status: COMPLETED (January 13, 2025)
Implementation: next-pwa with service workers
Features:
- Full PWA manifest with icons and shortcuts
- Offline fallback page
- Smart caching strategies for API and assets
- Background sync when reconnected
- Install prompt on mobile/desktop
Files: /public/manifest.json, next.config.ts updates, /public/offline.html
🧹 Priority 3: Codebase Cleanup & Maintenance
✅ Consolidate Serverless Logic:
Status: COMPLETED (January 13, 2025)
Lambda directory was already removed - all serverless logic is in app/api

✅ Complete TypeScript Integration:
Status: COMPLETED (January 13, 2025)
Created proper types for workspace data structures
Reduced any usage significantly (catch blocks still use any as standard)
Files: /types/workspace.ts