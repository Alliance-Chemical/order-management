import { NextRequest, NextResponse } from 'next/server';
import { requestOverride } from '@/lib/server/overrides';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const result = await requestOverride({
      type: body.type,
      orderId: body.orderId,
      workflowPhase: body.workflowPhase,
      reason: body.reason,
      requestedBy: body.requestedBy,
      workspaceId: body.workspaceId
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error requesting override:', error);
    return NextResponse.json(
      { error: 'Failed to request override' },
      { status: 500 }
    );
  }
}