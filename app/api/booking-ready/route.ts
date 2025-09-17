import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { and, eq, sql, desc } from 'drizzle-orm';

interface ShipstationParty {
  name?: string | null;
}

type ShipstationPayload = {
  shipTo?: ShipstationParty | null;
  billTo?: ShipstationParty | null;
};

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.workflowPhase, 'ready_to_ship'),
          // finalMeasurements is not null
          sql`${workspaces.finalMeasurements} is not null`
        )
      )
      .orderBy(desc(workspaces.updatedAt))
      .limit(200);

    const data = rows.map((w) => {
      const shipstationData = (w.shipstationData ?? {}) as ShipstationPayload;
      const customerName = shipstationData.shipTo?.name ?? shipstationData.billTo?.name ?? '';

      return {
        workspaceId: w.id,
        orderId: w.orderId,
        orderNumber: w.orderNumber,
        customerName,
        updatedAt: w.updatedAt,
        finalMeasurements: w.finalMeasurements,
      };
    });

    return NextResponse.json({ success: true, count: data.length, orders: data });
  } catch (error) {
    console.error('booking-ready list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load booking-ready orders' }, { status: 500 });
  }
}
