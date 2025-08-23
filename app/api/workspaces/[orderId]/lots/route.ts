import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';
import { asBigInt, jsonStringifyWithBigInt } from '@/lib/utils/bigint';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const orderIdBigInt = asBigInt(orderId);
    
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderIdBigInt))
      .limit(1);
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    // Get lot assignments from workspace data
    const lots = workspace.shipstationData?.lots || [];
    
    return new NextResponse(jsonStringifyWithBigInt({ lots }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching lots:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const orderIdBigInt = asBigInt(orderId);
    const body = await request.json();
    
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderIdBigInt))
      .limit(1);
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    // Create lot assignment
    const lotAssignment = {
      id: crypto.randomUUID(),
      qrCodeId: body.qrCodeId,
      lotNumber: body.lotNumber,
      assignedAt: new Date().toISOString(),
      assignedBy: body.userId || 'system'
    };
    
    // Update workspace with lot assignment
    const currentData = workspace.shipstationData || {};
    const lots = currentData.lots || [];
    lots.push(lotAssignment);
    
    await db
      .update(workspaces)
      .set({
        shipstationData: { ...currentData, lots },
        updatedAt: new Date()
      })
      .where(eq(workspaces.orderId, orderIdBigInt));
    
    return new NextResponse(jsonStringifyWithBigInt(lotAssignment), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error assigning lot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const orderIdBigInt = asBigInt(orderId);
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');
    
    if (!lotId) {
      return NextResponse.json({ error: 'Lot ID required' }, { status: 400 });
    }
    
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderIdBigInt))
      .limit(1);
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    // Remove lot assignment
    const currentData = workspace.shipstationData || {};
    const lots = (currentData.lots || []).filter((lot: any) => lot.id !== lotId);
    
    await db
      .update(workspaces)
      .set({
        shipstationData: { ...currentData, lots },
        updatedAt: new Date()
      })
      .where(eq(workspaces.orderId, orderIdBigInt));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing lot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}