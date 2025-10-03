import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';
import { normalizeOrderId } from '@/lib/utils/bigint';

type LotAssignment = {
  id: string;
  qrCodeId?: string;
  lotNumber?: string;
  assignedAt: string;
  assignedBy: string;
};

const isLotAssignment = (value: unknown): value is LotAssignment => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'assignedAt' in value &&
    'assignedBy' in value
  );
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const orderIdNum = normalizeOrderId(orderId);
    
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderIdNum))
      .limit(1);
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    const rawLots = (workspace.shipstationData as { lots?: unknown } | undefined)?.lots;
    const lots = Array.isArray(rawLots) ? rawLots.filter(isLotAssignment) : [];
    
    return NextResponse.json({ lots });
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
    const orderIdNum = normalizeOrderId(orderId);
    const body = await request.json() as {
      qrCodeId?: string;
      lotNumber?: string;
      userId?: string;
    };
    
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderIdNum))
      .limit(1);
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    // Create lot assignment
    const lotAssignment: LotAssignment = {
      id: crypto.randomUUID(),
      qrCodeId: body.qrCodeId,
      lotNumber: body.lotNumber,
      assignedAt: new Date().toISOString(),
      assignedBy: body.userId || 'system'
    };
    
    // Update workspace with lot assignment
    const currentData = workspace.shipstationData || {};
    const existingLots = Array.isArray((currentData as { lots?: unknown }).lots)
      ? ((currentData as { lots: unknown[] }).lots.filter(isLotAssignment))
      : [];
    const lots: LotAssignment[] = [...existingLots, lotAssignment];
    
    await db
      .update(workspaces)
      .set({
        shipstationData: { ...currentData, lots },
        updatedAt: new Date()
      })
      .where(eq(workspaces.orderId, orderIdNum));
    
    return NextResponse.json(lotAssignment, { status: 201 });
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
    const orderIdNum = normalizeOrderId(orderId);
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');
    
    if (!lotId) {
      return NextResponse.json({ error: 'Lot ID required' }, { status: 400 });
    }
    
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderIdNum))
      .limit(1);
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    // Remove lot assignment
    const currentData = workspace.shipstationData || {};
    const existingLots = Array.isArray((currentData as { lots?: unknown }).lots)
      ? ((currentData as { lots: unknown[] }).lots.filter(isLotAssignment))
      : [];
    const lots = existingLots.filter((lot) => lot.id !== lotId);
    
    await db
      .update(workspaces)
      .set({
        shipstationData: { ...currentData, lots },
        updatedAt: new Date()
      })
      .where(eq(workspaces.orderId, orderIdNum));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing lot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
