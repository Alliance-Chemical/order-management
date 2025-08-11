import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';

const repository = new WorkspaceRepository();

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = parseInt(params.orderId);
    const workspace = await repository.findByOrderId(orderId);
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const activities = await repository.getRecentActivity(workspace.id);
    
    return NextResponse.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}