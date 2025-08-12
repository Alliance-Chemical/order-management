import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces, activityLog } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { lineItemId, sourceContainerId, sourceContainerName, mode = 'add' } = await request.json();
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
    
    let updatedAssignments;
    if (mode === 'replace') {
      // Replace all assignments for this lineItemId
      updatedAssignments = existingAssignments.filter((a: any) => a.lineItemId !== lineItemId);
      updatedAssignments.push({
        lineItemId,
        sourceContainerId,
        sourceContainerName,
        assignedAt: new Date().toISOString(),
        assignedBy: 'supervisor' // In production, get from auth context
      });
    } else {
      // Add mode - keep existing assignments and add new one
      updatedAssignments = [...existingAssignments];
      // Don't add duplicate source containers
      const isDuplicate = updatedAssignments.some((a: any) => 
        a.lineItemId === lineItemId && a.sourceContainerId === sourceContainerId
      );
      
      if (!isDuplicate) {
        updatedAssignments.push({
          lineItemId,
          sourceContainerId,
          sourceContainerName,
          assignedAt: new Date().toISOString(),
          assignedBy: 'supervisor' // In production, get from auth context
        });
      }
    }

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
      activityType: 'source_assigned',
      metadata: {
        lineItemId,
        sourceContainerId,
        sourceContainerName,
        mode
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
  _request: NextRequest,
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