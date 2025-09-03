import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { WorkspaceService } from '@/lib/services/workspace/service';
import { tagSyncService } from '@/lib/services/shipstation/ensure-phase';
import { asBigInt, jsonStringifyWithBigInt } from '@/lib/utils/bigint';
import { db } from '@/lib/db';
import { activityLog, workspaces } from '@/lib/db/schema/qr-workspace';
import { and, eq, sql } from 'drizzle-orm';

const workspaceService = new WorkspaceService();

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; phase: string }> }
) => {
  const { orderId: orderIdStr, phase } = await params;
  const orderId = asBigInt(orderIdStr);
  const body = await request.json();
  const { result, data, userId = 'system', idempotencyKey } = body;
  
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
  const moduleStates = workspace.moduleStates || {};
  moduleStates[phase] = { 
    ...moduleStates[phase], 
    result,
    completedAt: new Date().toISOString(),
    data 
  };
  
  // Update module state and phase completion timestamp
  const phaseCompletedAt = (workspace.phaseCompletedAt as any) || {};
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
  let targetPhase = workspace.workflowPhase; // default to current
  let ensureResult = { success: true as boolean, finalTags: [] as any[], finalPhase: workspace.workflowPhase };
  
  if (result === 'pass') {
    // Only transition phase on PASS results
    if (phase === 'pre_ship_inspection') {
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

  return NextResponse.json(
    jsonStringifyWithBigInt({
      success: true,
      workspaceId: workspace.id,
      phase: ensureResult.finalPhase,
      tags: ensureResult.finalTags,
      result
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
