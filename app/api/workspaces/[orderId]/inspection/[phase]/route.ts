import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { WorkspaceService } from '@/lib/services/workspace/service';
import { tagSyncService } from '@/lib/services/shipstation/ensure-phase';
import { normalizeOrderId } from '@/lib/utils/bigint';
import { db } from '@/lib/db';
import { activityLog } from '@/lib/db/schema/qr-workspace';
import { and, eq, sql } from 'drizzle-orm';

const workspaceService = new WorkspaceService();

type InspectionPayload = {
  result: 'pass' | 'fail' | 'hold';
  data?: Record<string, unknown>;
  userId?: string;
  idempotencyKey?: string;
};

type ModuleStates = Record<string, unknown>;

type EnsureResult = {
  success: boolean;
  finalTags: unknown[];
  finalPhase: string;
  error?: unknown;
};

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; phase: string }> }
) => {
  const { orderId: orderIdStr, phase } = await params;
  const orderId = normalizeOrderId(orderIdStr);
  const { result, data, userId = 'system', idempotencyKey } = await request.json() as InspectionPayload;
  
  // Validate result (support pass | fail | hold)
  if (!['pass', 'fail', 'hold'].includes(result)) {
    return NextResponse.json({ error: 'Invalid result' }, { status: 400 });
  }
  
  // Find workspace
  const workspace = await workspaceService.repository.findByOrderId(Number(orderId));
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Idempotency: reject duplicate submissions with same key
  if (idempotencyKey) {
    const dup = await db.query.activityLog.findFirst({
      where: and(
        eq(activityLog.workspaceId, workspace.id),
        // metadata->>'idempotencyKey' = key
        sql`${activityLog.metadata} ->> 'idempotencyKey' = ${idempotencyKey}`
      ),
    });
    if (dup) {
      return NextResponse.json({ code: 'DUPLICATE', message: 'Duplicate submission' }, { status: 409 });
    }
  }
  
  // Update module state
  const moduleStates: ModuleStates = {
    ...(workspace.moduleStates as ModuleStates | undefined),
  };
  moduleStates[phase] = { 
    ...(moduleStates[phase] as Record<string, unknown> | undefined), 
    result,
    completedAt: new Date().toISOString(),
    data 
  };
  
  // Update module state and phase completion timestamp
  const phaseCompletedAt: Record<string, string> = {
    ...(workspace.phaseCompletedAt as Record<string, string> | undefined),
  };
  const nowIso = new Date().toISOString();
  phaseCompletedAt[phase] = nowIso;

  await workspaceService.repository.update(workspace.id, {
    moduleStates,
    updatedBy: userId,
    phaseCompletedAt,
  });
  
  // Log inspection activity
  await workspaceService.repository.logActivity({
    workspaceId: workspace.id,
    activityType: `inspection_${phase}_${result}`,
    performedBy: userId,
    metadata: { phase, result, data, idempotencyKey }
  });
  
  // Determine target phase based on inspection result
  let ensureResult: EnsureResult = {
    success: true,
    finalTags: [],
    finalPhase: workspace.workflowPhase || 'pre_mix',
  };
  
  if (result === 'pass') {
    // Only transition phase on PASS results
    // Align with workspace phases which use 'pre_ship'
    if (phase === 'pre_ship' || phase === 'pre_ship_inspection') {
      // Pre-ship pass -> mark as ready to ship
      ensureResult = await tagSyncService.ensurePhase(
        orderId,
        'ready_to_ship',
        userId
      );
      
      if (ensureResult.success) {
        await workspaceService.repository.logActivity({
          workspaceId: workspace.id,
          activityType: 'freight_ready_tagged',
          performedBy: 'system',
          metadata: { 
            trigger: 'pre_ship_inspection_passed',
            tags: ensureResult.finalTags
          }
        });
      }
    }
    // Add other phase transitions as needed
    // e.g., pre_mix_inspection pass could transition to next phase
  }
  
  // On FAIL or HOLD, phase stays the same (no tag changes)
  
  // Persist final phase if changed by ensurePhase
  if (ensureResult.success && ensureResult.finalPhase && ensureResult.finalPhase !== workspace.workflowPhase) {
    await workspaceService.repository.update(workspace.id, {
      workflowPhase: ensureResult.finalPhase,
    });
  }

  return NextResponse.json({
    success: true,
    workspaceId: workspace.id,
    phase: ensureResult.finalPhase,
    tags: ensureResult.finalTags,
    result,
  });
});
