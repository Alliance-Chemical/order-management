import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { WorkspaceService } from '@/lib/services/workspace/service';
import { tagSyncService } from '@/lib/services/shipstation/ensure-phase';
import { normalizeOrderId } from '@/lib/utils/bigint';

const workspaceService = new WorkspaceService();

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) => {
  const { orderId: orderIdStr } = await params;
  const orderId = normalizeOrderId(orderIdStr);
  const body = await request.json();
  
  // Find workspace
  const workspace = await workspaceService.repository.findByOrderId(Number(orderId));
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }
  
  // Update module state with locked planning
  const moduleStates = workspace.moduleStates || {};
  moduleStates.planning = { ...(moduleStates.planning as any), locked: true, plan: body.plan };
  
  await workspaceService.repository.update(workspace.id, {
    moduleStates,
    updatedBy: body.userId || 'system'
  });
  
  // Use ensurePhase to transition to pre_mix via ShipStation tags
  const result = await tagSyncService.ensurePhase(
    orderId, 
    'pre_mix',
    body.userId || 'system'
  );
  
  if (!result.success) {
    console.error('Failed to ensure phase:', result.error);
    // Still log the planning lock even if tag update failed
    await workspaceService.repository.logActivity({
      workspaceId: workspace.id,
      activityType: 'planning_locked',
      performedBy: body.userId || 'system',
      metadata: { 
        plan: body.plan,
        tagError: result.error
      }
    });
  } else {
    await workspaceService.repository.logActivity({
      workspaceId: workspace.id,
      activityType: 'planning_locked',
      performedBy: body.userId || 'system',
      metadata: { 
        plan: body.plan,
        phase: result.finalPhase,
        tags: result.finalTags
      }
    });
  }
  
  return NextResponse.json({
    success: true,
    workspaceId: workspace.id,
    phase: result.finalPhase,
    tags: result.finalTags
  });
});