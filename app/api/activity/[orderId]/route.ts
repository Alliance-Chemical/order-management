import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';

const repository = new WorkspaceRepository();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const workspace = await repository.findByOrderId(parseInt(orderId));
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get activity logs for this workspace
    const activities = await repository.getActivityLogs(workspace.id, {
      limit: 100,
      offset: 0,
    });

    return NextResponse.json({
      success: true,
      activities,
      total: activities.length,
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const body = await request.json();
    const { activityType, description, module, metadata } = body;

    if (!activityType || !description) {
      return NextResponse.json(
        { error: 'Activity type and description are required' },
        { status: 400 }
      );
    }

    const workspace = await repository.findByOrderId(parseInt(orderId));
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Log the activity
    const activity = await repository.logActivity({
      workspaceId: workspace.id,
      activityType,
      activityDescription: description,
      performedBy: 'system', // Replace with actual user from auth
      module,
      metadata: metadata || {},
    });

    return NextResponse.json({
      success: true,
      activity,
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 });
  }
}