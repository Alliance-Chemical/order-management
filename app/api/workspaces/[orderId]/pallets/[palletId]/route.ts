import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';
import { normalizeOrderId } from '@/lib/utils/bigint';

type Pallet = { id: string; [k: string]: unknown };

const isPallet = (value: unknown): value is Pallet => {
  return typeof value === 'object' && value !== null && 'id' in value;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; palletId: string }> }
) {
  try {
    const { orderId, palletId } = await params;
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
    
    // Update pallet
    const currentData = workspace.shipstationData || {};
    const maybePallets = (currentData as { pallets?: unknown }).pallets;
    const pallets: Pallet[] = Array.isArray(maybePallets)
      ? maybePallets.filter(isPallet)
      : [];
    const palletIndex = pallets.findIndex((p: Pallet) => p.id === palletId);
    
    if (palletIndex === -1) {
      return NextResponse.json({ error: 'Pallet not found' }, { status: 404 });
    }
    
    pallets[palletIndex] = {
      ...pallets[palletIndex],
      ...body,
      updatedAt: new Date().toISOString()
    };
    
    await db
      .update(workspaces)
      .set({
        shipstationData: { ...currentData, pallets },
        updatedAt: new Date()
      })
      .where(eq(workspaces.orderId, orderIdNum));
    
    return NextResponse.json(pallets[palletIndex]);
  } catch (error) {
    console.error('Error updating pallet:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; palletId: string }> }
) {
  try {
    const { orderId, palletId } = await params;
    const orderIdNum = normalizeOrderId(orderId);

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderIdNum))
      .limit(1);
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    // Remove pallet
    const currentData = workspace.shipstationData || {};
    const maybePallets = (currentData as { pallets?: unknown }).pallets;
    const pallets = Array.isArray(maybePallets)
      ? maybePallets.filter(isPallet).filter((pallet) => pallet.id !== palletId)
      : [];
    
    await db
      .update(workspaces)
      .set({
        shipstationData: { ...currentData, pallets },
        updatedAt: new Date()
      })
      .where(eq(workspaces.orderId, orderIdNum));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pallet:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
