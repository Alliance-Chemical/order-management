import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '@/lib/services/workspace/service';
import { withErrorHandler, AppError } from '@/lib/error-handler';

const workspaceService = new WorkspaceService();

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) => {
  const { orderId: orderIdStr } = await params;
  const orderId = parseInt(orderIdStr);
  
  if (isNaN(orderId)) {
    throw new AppError('Invalid order ID', 400);
  }
  
  const workspace = await workspaceService.repository.findByOrderId(orderId);
  
  if (!workspace) {
    throw new AppError('Workspace not found', 404);
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
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId: orderIdStr } = await params;
    const orderId = Number.parseInt(orderIdStr, 10);
    const body = await request.json();
    const { module, state, userId = 'system' } = body;

    if (Number.isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    await workspaceService.updateModuleState(orderIdStr, module, state, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating workspace:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
