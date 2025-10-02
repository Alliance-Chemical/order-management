import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '@/lib/services/workspace/service';
import { getEdgeDb, withEdgeRetry } from '@/lib/db/neon-edge';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { desc, eq } from 'drizzle-orm';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const workspaceService = new WorkspaceService();

export async function GET() {
  try {
    const db = getEdgeDb();
    const allWorkspaces = await withEdgeRetry(() =>
      db.select()
        .from(workspaces)
        .orderBy(desc(workspaces.createdAt))
        .limit(100)
    );

    return NextResponse.json({ workspaces: allWorkspaces });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type ActiveModules = NonNullable<typeof workspaces.$inferInsert['activeModules']>;
type ShipstationData = NonNullable<typeof workspaces.$inferInsert['shipstationData']>;

export async function POST(request: NextRequest) {
  try {
    const db = getEdgeDb();
    const body = await request.json() as {
      orderId: number | string;
      orderNumber: string;
      customerName?: string;
      customerEmail?: string;
      shipTo?: unknown;
      items?: unknown;
      workflowType?: 'pump_and_fill' | 'direct_resell';
      workflowPhase?: string;
      activeModules?: ActiveModules;
      userId?: string;
    };
    const { 
      orderId, 
      orderNumber, 
      customerName,
      customerEmail, 
      shipTo, 
      items, 
      workflowType = 'pump_and_fill',
      workflowPhase = 'planning',
      activeModules,
      userId = 'system' 
    } = body;

    if (!orderId || !orderNumber) {
      return NextResponse.json(
        { error: 'Order ID and order number are required' },
        { status: 400 }
      );
    }

    // Convert orderId to number for BigInt handling
    const orderIdNum = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;
    
    // Create workspace with workflow type
    const workspace = await workspaceService.createWorkspace(orderIdNum, orderNumber, userId, workflowType);
    
    // Update workspace with additional fields if provided
    const updateData: Partial<typeof workspaces.$inferInsert> = {};
    if (workflowPhase) updateData.workflowPhase = workflowPhase;
    if (activeModules) updateData.activeModules = activeModules;

    // Map customer/order details into shipstationData JSON
    const shipstationPatch: Record<string, unknown> = {};
    if (customerName) shipstationPatch.customerName = customerName;
    if (customerEmail) shipstationPatch.customerEmail = customerEmail;
    if (shipTo) shipstationPatch.shipTo = shipTo;
    if (items) shipstationPatch.items = items;

    if (Object.keys(shipstationPatch).length > 0) {
      updateData.shipstationData = shipstationPatch as ShipstationData;
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      await db
        .update(workspaces)
        .set(updateData)
        .where(eq(workspaces.orderId, orderIdNum));
    }

    // Return workspace with orderId as string for BigInt handling
    const responseWorkspace = {
      ...workspace,
      orderId: workspace.orderId.toString()
    };

    return NextResponse.json(responseWorkspace, { status: 201 });
  } catch (error) {
    console.error('Error creating workspace:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
