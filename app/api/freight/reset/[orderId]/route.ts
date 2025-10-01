import { NextRequest, NextResponse } from 'next/server';
import { getOptimizedDb } from '@/lib/db/neon';
import { workspaces, activityLog } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';
import { tagSyncService } from '@/lib/services/shipstation/ensure-phase';

export const runtime = 'nodejs';

type ModuleStates = Record<string, unknown>;
type PhaseCompletedAt = Record<string, string>;

export async function POST(
  _request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = parseInt(params.orderId, 10);

    if (!orderId || isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    const db = getOptimizedDb();

    // Fetch the workspace
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderId))
      .limit(1);

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Prepare updated module states
    const currentModuleStates = (workspace.moduleStates || {}) as ModuleStates;
    const updatedModuleStates: ModuleStates = { ...currentModuleStates };

    // Clear pre_ship completion
    if (updatedModuleStates.pre_ship && typeof updatedModuleStates.pre_ship === 'object') {
      updatedModuleStates.pre_ship = {
        ...(updatedModuleStates.pre_ship as Record<string, unknown>),
        completed: false,
      };
    }

    // Clear phase_completed_at for pre_ship
    const currentPhaseCompletedAt = (workspace.phaseCompletedAt || {}) as PhaseCompletedAt;
    const updatedPhaseCompletedAt: PhaseCompletedAt = { ...currentPhaseCompletedAt };
    delete updatedPhaseCompletedAt.pre_ship;

    // Update workspace
    await db
      .update(workspaces)
      .set({
        moduleStates: updatedModuleStates,
        phaseCompletedAt: updatedPhaseCompletedAt,
        workflowPhase: 'in_progress',
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspace.id));

    // Log activity
    await db.insert(activityLog).values({
      workspaceId: workspace.id,
      activityType: 'reset_to_queue',
      activityDescription: `Order reset to active queue from ${workspace.workflowPhase}`,
      performedBy: 'supervisor',
      module: 'freight',
      metadata: {
        orderId,
        previousPhase: workspace.workflowPhase,
        reason: 'reset_to_queue',
      },
    });

    // Best-effort tag sync (don't fail if ShipStation errors)
    try {
      await tagSyncService.ensurePhase(orderId, 'in_progress', 'supervisor');
    } catch (tagError) {
      console.warn('Tag sync failed (non-fatal):', tagError);
    }

    return NextResponse.json({
      success: true,
      message: 'Order reset to queue successfully',
      data: {
        orderId,
        workflowPhase: 'in_progress',
        status: 'active',
      },
    });
  } catch (error) {
    console.error('Failed to reset order:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reset order',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
