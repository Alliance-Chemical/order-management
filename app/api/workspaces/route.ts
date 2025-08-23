import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '@/lib/services/workspace/service';
import { jsonStringifyWithBigInt } from '@/lib/utils/bigint';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { desc, eq } from 'drizzle-orm';

const workspaceService = new WorkspaceService();

export async function GET() {
  try {
    const allWorkspaces = await db
      .select()
      .from(workspaces)
      .orderBy(desc(workspaces.createdAt))
      .limit(100);

    return new NextResponse(jsonStringifyWithBigInt({ workspaces: allWorkspaces }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
    const updateData: any = {};
    if (customerName) updateData.customerName = customerName;
    if (customerEmail) updateData.customerEmail = customerEmail;
    if (shipTo) updateData.shipTo = shipTo;
    if (items) updateData.items = items;
    if (workflowPhase) updateData.workflowPhase = workflowPhase;
    if (activeModules) updateData.activeModules = activeModules;
    
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