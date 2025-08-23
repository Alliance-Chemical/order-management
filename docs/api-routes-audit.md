# API Routes Audit

## ✅ Workspace Core Routes

- ✅ `POST /api/workspaces` - Create/import workspace (`app/api/workspaces/route.ts`)
- ✅ `GET /api/workspace/:orderId` - Fetch workspace (`app/api/workspace/[orderId]/route.ts`)
- ✅ `POST /api/workspaces/:orderId/planning/lock` - Lock planning (`app/api/workspaces/[orderId]/planning/lock/route.ts`)
- ✅ `POST /api/workspaces/:orderId/inspection/:phase` - Pass/fail inspection (`app/api/workspaces/[orderId]/inspection/[phase]/route.ts`)
- ✅ `POST /api/workspace/:orderId/ship` - Mark shipped (`app/api/workspace/[orderId]/ship/route.ts`)

## ❌ Palletization Routes (MISSING)

- ❌ `GET /api/workspaces/:orderId/pallets` - List pallets
- ❌ `POST /api/workspaces/:orderId/pallets` - Create pallet
- ❌ `PATCH /api/workspaces/:orderId/pallets/:palletId` - Update pallet
- ❌ `DELETE /api/workspaces/:orderId/pallets/:palletId` - Delete pallet
- ❌ `POST /api/workspaces/:orderId/pallets/:palletId/items` - Add items to pallet

## ❌ Lot Numbers Routes (MISSING)

- ❌ `GET /api/workspaces/:orderId/lots` - Get lot assignments
- ❌ `POST /api/workspaces/:orderId/lots` - Assign lot numbers
- ❌ `DELETE /api/workspaces/:orderId/lots/:lotId` - Remove lot assignment

## ⚠️ ShipStation Sync Routes (PARTIAL)

- ❌ `POST /api/workspaces/:orderId/sync-notes` - Build + push customer note
- ❌ `POST /api/workspaces/:orderId/tags/ensure` - Ensure phase → tags
- ✅ `POST /api/webhook/shipstation` - Webhook handler (`app/api/webhook/shipstation/route.ts`)
- ✅ `POST /api/shipstation/webhook` - Alternative webhook path (`app/api/shipstation/webhook/route.ts`)
- ✅ `POST /api/shipstation/webhook/tag-sync` - Tag sync (`app/api/shipstation/webhook/tag-sync/route.ts`)

## ✅ Presence Routes

- ✅ `GET /api/presence/:workspaceId` - Get presence (`app/api/presence/[workspaceId]/route.ts`)
- ✅ `POST /api/presence/:workspaceId/touch` - Update presence (`app/api/presence/[workspaceId]/touch/route.ts`)
- ✅ `POST /api/presence/:workspaceId/clear` - Clear presence (`app/api/presence/[workspaceId]/clear/route.ts`)

## ✅ Override Routes

- ✅ `POST /api/overrides/request` - Request override (`app/api/overrides/request/route.ts`)
- ✅ `POST /api/overrides/:id/approve` - Approve override (`app/api/overrides/[id]/approve/route.ts`)
- ✅ `POST /api/overrides/:id/use` - Use override (`app/api/overrides/[id]/use/route.ts`)

## ✅ Queue Routes

- ✅ `POST /api/queue/process` - Process queue (`app/api/queue/process/route.ts`)
- ✅ `GET /api/queue/stats` - Queue statistics (`app/api/queue/stats/route.ts`)
- ✅ `POST /api/queue/deadletter/retry` - Retry dead letters (`app/api/queue/deadletter/retry/route.ts`)

## Summary

### Complete ✅
- Workspace core operations
- Presence tracking
- Override system
- Queue processing

### Missing ❌
- **Palletization** - All pallet CRUD operations
- **Lot numbers** - Assignment and management
- **ShipStation sync** - Notes sync and tag ensure endpoints

### Recommendations
1. Implement palletization routes for pallet management
2. Implement lot number assignment routes
3. Add sync-notes and tags/ensure endpoints for ShipStation integration