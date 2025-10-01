import { NextRequest, NextResponse } from 'next/server';
import { getOptimizedDb } from '@/lib/db/neon';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { freightOrders } from '@/lib/db/schema/freight';
import { eq, sql, or } from 'drizzle-orm';

export const runtime = 'nodejs';

type ModuleStates = Record<string, unknown>;

function isPreShipCompleted(moduleStates: unknown): boolean {
  if (!moduleStates || typeof moduleStates !== 'object') return false;
  const states = moduleStates as ModuleStates;
  const preShip = states.pre_ship;
  if (!preShip || typeof preShip !== 'object') return false;
  return (preShip as Record<string, unknown>).completed === true;
}

export async function GET(_request: NextRequest) {
  try {
    const db = getOptimizedDb();

    // Get all active workspaces with optional freight_orders join
    const allWorkspaces = await db
      .select({
        id: workspaces.id,
        orderId: workspaces.orderId,
        orderNumber: workspaces.orderNumber,
        status: workspaces.status,
        workflowPhase: workspaces.workflowPhase,
        moduleStates: workspaces.moduleStates,
        shipstationData: workspaces.shipstationData,
        updatedAt: workspaces.updatedAt,
        bookingStatus: freightOrders.bookingStatus,
        bookedAt: freightOrders.bookedAt,
        carrierName: freightOrders.carrierName,
        trackingNumber: freightOrders.trackingNumber,
      })
      .from(workspaces)
      .leftJoin(freightOrders, eq(workspaces.orderId, freightOrders.orderId))
      .where(
        or(
          eq(workspaces.status, 'active'),
          eq(workspaces.status, 'in_progress')
        )
      )
      .orderBy(sql`${workspaces.updatedAt} DESC`);

    // Bucket the workspaces
    const unready = [];
    const ready_to_book = [];
    const booked = [];

    for (const ws of allWorkspaces) {
      const preShipCompleted = isPreShipCompleted(ws.moduleStates);
      const isBooked = ws.bookingStatus === 'booked';

      // Extract customer name from shipstation data
      let customerName = 'Unknown';
      if (ws.shipstationData && typeof ws.shipstationData === 'object') {
        const ssData = ws.shipstationData as Record<string, unknown>;
        if (ssData.shipTo && typeof ssData.shipTo === 'object') {
          const shipTo = ssData.shipTo as Record<string, unknown>;
          customerName = (shipTo.name as string) || 'Unknown';
        }
      }

      const order = {
        id: ws.id,
        orderId: ws.orderId,
        orderNumber: ws.orderNumber,
        status: ws.status,
        workflowPhase: ws.workflowPhase,
        customerName,
        updatedAt: ws.updatedAt,
        bookingStatus: ws.bookingStatus,
        bookedAt: ws.bookedAt,
        carrierName: ws.carrierName,
        trackingNumber: ws.trackingNumber,
      };

      // Booked lane
      if (isBooked) {
        booked.push(order);
        continue;
      }

      // Ready to book lane
      if (ws.workflowPhase === 'ready_to_ship' || preShipCompleted) {
        ready_to_book.push(order);
        continue;
      }

      // Unready lane (everything else that's active)
      unready.push(order);
    }

    return NextResponse.json({
      success: true,
      data: {
        unready,
        ready_to_book,
        booked,
      },
      counts: {
        unready: unready.length,
        ready_to_book: ready_to_book.length,
        booked: booked.length,
      },
    });
  } catch (error) {
    console.error('Failed to fetch freight HUD data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch freight HUD data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
