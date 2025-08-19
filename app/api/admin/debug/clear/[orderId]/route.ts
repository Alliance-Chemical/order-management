import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = parseInt(params.orderId);
    
    if (isNaN(orderId)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    // Clear inspection data from module states

    // Reset workspace module states
    const workspace = await db.select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderId))
      .limit(1);

    if (workspace.length > 0) {
      await db.update(workspaces)
        .set({
          moduleStates: {},
          workflowPhase: 'pending',
          updatedAt: new Date()
        })
        .where(eq(workspaces.orderId, orderId));
    }

    return NextResponse.json({
      success: true,
      message: `Cleared inspection for order ${orderId}`
    });
  } catch (error) {
    console.error('Failed to clear inspection:', error);
    return NextResponse.json(
      { error: 'Failed to clear inspection' },
      { status: 500 }
    );
  }
}