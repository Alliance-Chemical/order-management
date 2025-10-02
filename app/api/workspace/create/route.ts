import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '@/lib/services/workspace/service';

const workspaceService = new WorkspaceService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, orderNumber, userId = 'system' } = body;

    if (!orderId || !orderNumber) {
      return NextResponse.json(
        { error: 'Order ID and order number are required' },
        { status: 400 }
      );
    }

    const workspace = await workspaceService.createWorkspace(orderId, orderNumber, userId);

    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    console.error('Error creating workspace:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}