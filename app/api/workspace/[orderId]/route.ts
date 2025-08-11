import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '@/lib/services/workspace/service';

const workspaceService = new WorkspaceService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId: orderIdStr } = await params;
    const orderId = parseInt(orderIdStr);
    const workspace = await workspaceService.repository.findByOrderId(orderId);
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Update access time
    await workspaceService.repository.updateAccessTime(workspace.id, 'system');

    // Check if sync needed (>30 seconds old)
    const needsSync = workspace.lastShipstationSync && 
      (Date.now() - workspace.lastShipstationSync.getTime()) > 30000;
    
    if (needsSync) {
      await workspaceService.syncWithShipStation(workspace.id, orderId);
    }

    return NextResponse.json(workspace);
  } catch (error) {
    console.error('Error fetching workspace:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId: orderIdStr } = await params;
    const orderId = parseInt(orderIdStr);
    const body = await request.json();
    const { module, state, userId = 'system' } = body;

    await workspaceService.updateModuleState(orderIdStr, module, state, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating workspace:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}