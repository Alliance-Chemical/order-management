import { NextRequest, NextResponse } from 'next/server';
import { getOptimizedDb } from '@/lib/db/neon';
import { workspaces, activityLog } from '@/lib/db/schema/qr-workspace';
import { freightOrders, freightEvents } from '@/lib/db/schema/freight';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * Booking Stub Endpoint
 *
 * This is a stub for future MyCarrier integration.
 * For now, it simply marks the order as booked in the database.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = parseInt(params.orderId, 10);

    if (!orderId || isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    const db = getOptimizedDb();

    // Fetch the workspace
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderId))
      .limit(1);

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const now = new Date();

    // Upsert freight_orders row
    const [freightOrder] = await db
      .insert(freightOrders)
      .values({
        workspaceId: workspace.id,
        orderId,
        orderNumber: workspace.orderNumber,
        bookingStatus: 'booked',
        bookedAt: now,
        createdBy: 'supervisor',
        updatedBy: 'supervisor',
      })
      .onConflictDoUpdate({
        target: freightOrders.orderId,
        set: {
          bookingStatus: 'booked',
          bookedAt: now,
          updatedAt: now,
          updatedBy: 'supervisor',
        },
      })
      .returning();

    // Insert freight event
    await db.insert(freightEvents).values({
      freightOrderId: freightOrder.id,
      eventType: 'booked',
      eventDescription: 'Order manually marked as booked by supervisor',
      performedBy: 'supervisor',
      eventData: {
        orderId,
        bookedAt: now.toISOString(),
      },
    });

    // Log activity
    await db.insert(activityLog).values({
      workspaceId: workspace.id,
      activityType: 'freight_booked',
      activityDescription: 'Freight booking confirmed',
      performedBy: 'supervisor',
      module: 'freight',
      metadata: {
        orderId,
        bookedAt: now.toISOString(),
        freightOrderId: freightOrder.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Order marked as booked successfully',
      data: {
        orderId,
        bookingStatus: 'booked',
        bookedAt: now,
        freightOrderId: freightOrder.id,
      },
    });
  } catch (error) {
    console.error('Failed to book order:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to book order',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
