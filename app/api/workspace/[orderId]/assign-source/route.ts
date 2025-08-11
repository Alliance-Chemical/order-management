import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces, activityLog } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { lineItemId, sourceContainerId, sourceContainerName } = await request.json();
    const orderId = Number(params.orderId);

    if (!lineItemId || !sourceContainerId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch the workspace
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderId))
      .limit(1);

    if (!workspace || workspace.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const workspaceRecord = workspace[0];
    
    // Get existing source assignments or initialize empty array
    const existingAssignments = (workspaceRecord.moduleStates as any)?.sourceAssignments || [];
    
    // Update or add the assignment
    const updatedAssignments = existingAssignments.filter((a: any) => a.lineItemId !== lineItemId);
    updatedAssignments.push({
      lineItemId,
      sourceContainerId,
      sourceContainerName,
      assignedAt: new Date().toISOString(),
      assignedBy: 'supervisor' // In production, get from auth context
    });

    // Update the workspace with new assignments
    await db
      .update(workspaces)
      .set({
        moduleStates: {
          ...(workspaceRecord.moduleStates as any || {}),
          sourceAssignments: updatedAssignments
        },
        updatedAt: new Date()
      })
      .where(eq(workspaces.id, workspaceRecord.id));

    // Log the activity
    await db.insert(activityLog).values({
      workspaceId: workspaceRecord.id,
      action: 'source_assigned',
      details: {
        lineItemId,
        sourceContainerId,
        sourceContainerName
      },
      performedBy: 'supervisor', // In production, get from auth context
      performedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Source container assigned successfully'
    });

  } catch (error) {
    console.error('Error assigning source container:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to assign source container' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = Number(params.orderId);

    // Fetch the workspace
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderId))
      .limit(1);

    if (!workspace || workspace.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const workspaceRecord = workspace[0];
    const sourceAssignments = (workspaceRecord.moduleStates as any)?.sourceAssignments || [];

    return NextResponse.json({
      success: true,
      sourceAssignments
    });

  } catch (error) {
    console.error('Error fetching source assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch source assignments' },
      { status: 500 }
    );
  }
}