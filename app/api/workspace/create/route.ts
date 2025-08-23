import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '@/lib/services/workspace/service';
import { jsonStringifyWithBigInt } from '@/lib/utils/bigint';

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

    return new NextResponse(jsonStringifyWithBigInt(workspace), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating workspace:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}