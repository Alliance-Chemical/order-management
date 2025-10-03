import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';
import { normalizeOrderId } from '@/lib/utils/bigint';

type PalletItem = {
  id: string;
  name?: string;
  quantity?: number;
  addedAt: string;
  [key: string]: unknown;
};

type PalletEntry = {
  id: string;
  items?: PalletItem[];
  updatedAt?: string;
  [key: string]: unknown;
};

const isPalletEntry = (value: unknown): value is PalletEntry => {
  return typeof value === 'object' && value !== null && 'id' in value;
};

const isPalletItem = (value: unknown): value is PalletItem => {
  return typeof value === 'object' && value !== null && 'id' in value;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; palletId: string }> }
) {
  try {
    const { orderId, palletId } = await params;
    const orderIdNum = normalizeOrderId(orderId);
    const body = await request.json() as Record<string, unknown>;
    
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderIdNum))
      .limit(1);
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    // Find pallet and add items
    const currentData = workspace.shipstationData || {};
    const maybePallets = (currentData as { pallets?: unknown }).pallets;
    const pallets: PalletEntry[] = Array.isArray(maybePallets)
      ? maybePallets.filter(isPalletEntry)
      : [];
    const palletIndex = pallets.findIndex((pallet) => pallet.id === palletId);
    
    if (palletIndex === -1) {
      return NextResponse.json({ error: 'Pallet not found' }, { status: 404 });
    }
    
    const newItem: PalletItem = {
      id: crypto.randomUUID(),
      ...body,
      addedAt: new Date().toISOString()
    };

    const existingItems = Array.isArray(pallets[palletIndex].items)
      ? (pallets[palletIndex].items ?? []).filter(isPalletItem)
      : [];

    const updatedPallet: PalletEntry = {
      ...pallets[palletIndex],
      items: [...existingItems, newItem],
      updatedAt: new Date().toISOString(),
    };

    const updatedPallets = [...pallets];
    updatedPallets[palletIndex] = updatedPallet;
    
    await db
      .update(workspaces)
      .set({
        shipstationData: { ...currentData, pallets: updatedPallets },
        updatedAt: new Date()
      })
      .where(eq(workspaces.orderId, orderIdNum));
    
    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error('Error adding items to pallet:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
