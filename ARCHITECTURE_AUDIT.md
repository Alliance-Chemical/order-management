# Architecture Audit Report
**Date:** 2025-10-01
**Status:** Critical Issues Identified

## Executive Summary
Severe architectural debt from dual directory structure (/lib vs /src) creating:
- Duplicate schemas with risk of divergence
- Missing tables from migration system
- 13 files importing from abandoned /src structure
- Confusion about canonical code location

---

## Critical Findings

### 1. Duplicate Database Schemas

#### `/lib/db/schema/freight.ts` (309 lines)
**Tables:**
- `freightOrders`
- `freightQuotes`
- `freightEvents`
- Complete relations defined

**Drizzle Config:** ✅ INCLUDED in `drizzle.config.ts`

#### `/src/data/db/schema/` (split files)
**Tables:**
- `freightOrders.ts` (82 lines) - DUPLICATE of lib version
- `freightQuotes.ts` - DUPLICATE
- `freightEvents.ts` - DUPLICATE
- `freightClassifications.ts` - ⚠️ MISSING FROM /lib
- `chemicalProducts.ts` (products) - ⚠️ MISSING FROM /lib
- `productFreightLinks.ts` - ⚠️ MISSING FROM /lib

**Drizzle Config:** ❌ NOT INCLUDED - **MIGRATIONS WILL NOT RUN**

**RISK LEVEL:** 🔴 **CRITICAL**
These 3 extra tables are orphaned from the migration system!

---

### 2. File Count Analysis

| Directory | TypeScript Files | Purpose |
|-----------|-----------------|---------|
| `/lib` | 104 | Main codebase |
| `/src` | 25 | Abandoned DDD attempt |

**Ratio:** /lib has 4x more code - clearly the main codebase

---

### 3. Import Analysis

**Files importing from `/src/`:** 13 files
```
/home/andre/my-app/lib/db/index.ts ← Wrapper importing from /src
/home/andre/my-app/lib/services/freight/batch-polling.ts
/home/andre/my-app/lib/services/outbox/processor.ts
/home/andre/my-app/lib/services/feature-flags.ts
/home/andre/my-app/app/api/freight-orders/poll/route.ts
/home/andre/my-app/app/api/freight-orders/work-queue/route.ts
/home/andre/my-app/app/api/qr/generate/route.ts
/home/andre/my-app/app/actions/qr.ts
(+ 5 more scripts)
```

**All other imports (731 occurrences):** Use `/lib` via `@/` alias

---

### 4. Directory Structure Comparison

#### `/src` Structure (Domain-Driven Design attempt)
```
/src
├── data/          ← Data access layer
│   ├── db/
│   │   ├── client.ts      (singleton DB client)
│   │   └── schema/        (7 schema files)
│   └── qr/
│       └── qrRepository.ts
├── domain/        ← Domain logic
│   └── qr/        (QR types, codecs, builders)
├── services/      ← Application services
│   └── qr/        (generators, validators, renderers)
└── shared/        ← Shared utilities
    └── ui/        (UI components)
```

#### `/lib` Structure (Current main codebase)
```
/lib
├── db/
│   ├── index.ts   ← Wrapper importing from /src! 🔴
│   ├── schema/    (5 schema files - CANONICAL)
│   ├── neon.ts
│   └── neon-edge.ts
├── services/      ← Mixed patterns
│   ├── workspace/ (repository pattern)
│   ├── qr/        (functional)
│   ├── ai/        (class-based)
│   └── [...many more]
├── freight-booking/
├── hazmat/
├── rag/
├── inspection/
├── measurements/
└── [...extensive structure]
```

---

### 5. Database Client Chain

**Current Flow:**
```
App Code
  ↓ import { db } from '@/lib/db'
/lib/db/index.ts
  ↓ export const db = getDb()
  ↓ export { getDb } from '../../src/data/db/client'
/src/data/db/client.ts
  ↓ Lazy singleton initialization
  ↓ Imports schemas from /lib/db/schema/ ← Goes back to /lib! 🔄
Database Connection
```

**Indirection Count:** 3 layers
**Benefit:** None - pure overhead

---

### 6. QR Service Duplication

#### `/src/services/qr/`
- `qrGenerator.ts`
- `qrValidation.ts`
- `qrPngRenderer.ts`
- `qrSvgRenderer.ts`

#### `/lib/services/qr/`
- `generator.ts` - Different file, possibly duplicate logic
- `validation.ts` - Different file, possibly duplicate logic
- `shortcode.ts`
- `container-detect.ts`

**Status:** Needs code comparison to determine overlap

---

## Recommendations

### Phase 1: Critical (Week 1)

**Priority 1: Fix Missing Schemas**
- [ ] Move `freightClassifications.ts` to `/lib/db/schema/freight.ts`
- [ ] Move `chemicalProducts.ts` to `/lib/db/schema/freight.ts`
- [ ] Move `productFreightLinks.ts` to `/lib/db/schema/freight.ts`
- [ ] Verify migrations pick up all tables
- [ ] Test database schema completeness

**Priority 2: Eliminate /src Directory**
- [ ] Update 13 files importing from `/src/`
- [ ] Remove `/lib/db/index.ts` wrapper
- [ ] Point all imports directly to `/lib/db/client.ts` (to be created)
- [ ] Delete `/src` directory entirely

**Priority 3: Simplify DB Client**
- [ ] Move `/src/data/db/client.ts` → `/lib/db/client.ts`
- [ ] Remove wrapper indirection
- [ ] Update all imports

### Phase 2: Build Quality (Week 2)

**Priority 4: Re-enable Quality Gates**
- [ ] Fix TypeScript errors
- [ ] Fix ESLint violations
- [ ] Remove `ignoreBuildErrors: true`
- [ ] Remove `ignoreDuringBuilds: true`

### Phase 3: Architecture Cleanup (Week 3-4)

**Priority 5: Consolidate Patterns**
- [ ] Audit QR service duplication
- [ ] Choose single service pattern (class vs functional)
- [ ] Establish clear layer boundaries

---

## Decision Record

### DR-001: Consolidate to /lib
**Date:** 2025-10-01
**Decision:** Use `/lib` as single source of truth, eliminate `/src`

**Rationale:**
1. `/lib` has 4x more code (104 vs 25 files)
2. 98% of imports already use `/lib`
3. `/src` appears to be abandoned DDD experiment
4. Drizzle config points to `/lib/db/schema/`
5. Simpler to migrate 13 files than restructure entire codebase

**Action Items:**
- Move missing schemas from `/src` to `/lib`
- Update 13 import statements
- Delete `/src` directory
- Update documentation

---

## Risk Assessment

| Issue | Current Risk | After Fix |
|-------|--------------|-----------|
| Missing table migrations | 🔴 Critical | 🟢 Low |
| Schema divergence | 🔴 Critical | 🟢 Low |
| Code confusion | 🟡 Medium | 🟢 Low |
| Build quality | 🔴 Critical | 🟡 Medium |
| Onboarding complexity | 🟡 Medium | 🟢 Low |

---

## Next Steps

1. **Create backup** of `/src` directory
2. **Move orphaned schemas** to `/lib/db/schema/freight.ts`
3. **Test migrations** generate for all tables
4. **Update imports** in 13 affected files
5. **Verify application** still functions
6. **Delete `/src`** directory
7. **Document** new structure in CLAUDE.md
