import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';
import { normalizeOrderId } from '@/lib/utils/bigint';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const orderIdNum = normalizeOrderId(orderId);

    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderIdNum))
      .limit(1);
    
    if (!workspace.length) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    // Get pallets from workspace data or return empty array
    const pallets = workspace[0].shipstationData?.pallets || [];
    
    return NextResponse.json({ pallets });
  } catch (error) {
    console.error('Error fetching pallets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const orderIdNum = normalizeOrderId(orderId);
    const body = await request.json();

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderIdNum))
      .limit(1);
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    // Create new pallet
    const newPallet = {
      id: crypto.randomUUID(),
      ...body,
      createdAt: new Date().toISOString()
    };
    
    // Update workspace with new pallet
    const currentData = workspace.shipstationData || {};
    const pallets = currentData.pallets || [];
    pallets.push(newPallet);
    
    await db
      .update(workspaces)
      .set({
        shipstationData: { ...currentData, pallets },
        updatedAt: new Date()
      })
      .where(eq(workspaces.orderId, orderIdNum));
    
    return NextResponse.json(newPallet, { status: 201 });
  } catch (error) {
    console.error('Error creating pallet:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}