import { NextRequest, NextResponse } from 'next/server';
import { getOptimizedDb } from '@/lib/db/neon';
import { workspaces, activityLog } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

interface ArchiveRequestBody {
  reason?: string;
}

export async function POST(
  request: NextRequest,
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

    // Parse request body for optional reason
    let reason = 'Manual archive by supervisor';
    try {
      const body = (await request.json()) as ArchiveRequestBody;
      if (body.reason && typeof body.reason === 'string') {
        reason = body.reason.trim() || reason;
      }
    } catch {
      // Body is optional, use default reason
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

    // Check if already archived
    if (workspace.status === 'archived') {
      return NextResponse.json(
        { success: false, error: 'Order is already archived' },
        { status: 400 }
      );
    }

    // Update workspace to archived
    const now = new Date();
    await db
      .update(workspaces)
      .set({
        status: 'archived',
        archivedAt: now,
        updatedAt: now,
      })
      .where(eq(workspaces.id, workspace.id));

    // Log activity
    await db.insert(activityLog).values({
      workspaceId: workspace.id,
      activityType: 'archived',
      activityDescription: `Order archived: ${reason}`,
      performedBy: 'supervisor',
      module: 'freight',
      metadata: {
        orderId,
        reason,
        previousStatus: workspace.status,
        previousPhase: workspace.workflowPhase,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Order archived successfully',
      data: {
        orderId,
        status: 'archived',
        archivedAt: now,
        reason,
      },
    });
  } catch (error) {
    console.error('Failed to archive order:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to archive order',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
