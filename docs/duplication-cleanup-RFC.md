# Duplication Cleanup RFC

Goal: reduce duplicate modules to a single source of truth with minimal behavioral change.

Scope and Evidence
- Two QR generators:
  - `lib/services/qr/generator.ts` used by API routes (print/scan/generate)
  - `src/services/qr/qrGenerator.ts` modular implementation (codecs + renderers)
  - Risk: divergence in URL/encoding/quiet-zone; maintenance overhead.

- Two QR scanners:
  - `components/qr/QRScanner.tsx` (basic)
  - `components/qr/ValidatedQRScanner.tsx` (validation + manual entry + cues)

- Two inspection screens:
  - `components/workspace/agent-view/InspectionScreen.tsx`
  - `components/workspace/agent-view/ResilientInspectionScreen.tsx` (state persistence, offline queue)

- Duplicate “inspection items” builder logic in:
  - `app/workspace/[orderId]/page.tsx` and `app/workspace/[orderId]/workspace-content.tsx`

- Mixed activity logging paths:
  - Repository-based vs direct Edge drizzle inserts

Phase 1 (completed): Canonical QR generator
- Change: switch API routes to `src/services/qr/qrGenerator.ts` imports.
- Files updated:
  - `app/api/qr/print/route.ts`
  - `app/api/qr/scan/route.ts`
  - `app/api/qr/generate/route.ts`
  - `app/api/queue/process/route.ts`
  - `app/api/shopify/sync-products/route.ts`
- Rationale: converge on modular generator and renderer stack; behavior preserved.

Next phases (pending approval per module):
- Phase 2: Standardize scanner → use `ValidatedQRScanner` everywhere, deprecate `QRScanner`.
- Phase 3: Single inspection screen → route all usage to `ResilientInspectionScreen`.
- Phase 4: Extract inspection items → `lib/inspection/items.ts` for shared logic.
- Phase 5: Activity logger helper that normalizes Edge/Node.
- Phase 6: Remove dead code (e.g., unused toast) after confirming no references.

Rollback Plan
- Each phase is isolated (import changes only in Phase 1). Reverting is restoring previous import paths.

