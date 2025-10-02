import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';
import { normalizeOrderId } from '@/lib/utils/bigint';
import { ShipStationClient } from '@/lib/services/shipstation/client';

type ModuleStateEntry = {
  result?: string;
  notes?: string;
  [key: string]: unknown;
};

type LotAssignment = {
  id: string;
  lotNumber?: string;
  [key: string]: unknown;
};

const shipstation = new ShipStationClient();

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
    
    // Build consolidated notes from workspace data
    const notes = [];
    
    // Add inspection results
    if (workspace.moduleStates) {
      Object.entries(workspace.moduleStates).forEach(([phase, state]) => {
        const moduleState = state as ModuleStateEntry;
        if (moduleState.result) {
          notes.push(`${phase}: ${moduleState.result.toUpperCase()}`);
          if (moduleState.notes) {
            notes.push(`  Notes: ${moduleState.notes}`);
          }
        }
      });
    }
    
    // Add lot assignments
    const lots = workspace.shipstationData?.lots || [];
    if (Array.isArray(lots) && lots.length > 0) {
      notes.push('\nLot Assignments:');
      (lots as LotAssignment[]).forEach((lot) => {
        notes.push(`  - ${lot.lotNumber ?? 'Unknown lot'}`);
      });
    }
    
    // Add any custom notes from request
    if (body.additionalNotes) {
      notes.push('\n' + body.additionalNotes);
    }
    
    const consolidatedNotes = notes.join('\n');
    
    // Push to ShipStation
    let syncResult: { success: boolean; error: string | null; response?: any } = { success: false, error: null };
    
    try {
      // Update order notes in ShipStation
      const response = await shipstation.updateOrder(Number(orderId), {
        customerNotes: consolidatedNotes,
        internalNotes: `Updated from QR Workspace on ${new Date().toISOString()}`
      });
      
      syncResult = { success: true, response };
      
      // Update workspace with sync timestamp
      await db
        .update(workspaces)
        .set({
          lastShipstationSync: new Date(),
          updatedAt: new Date()
        })
        .where(eq(workspaces.orderId, orderIdNum));
        
    } catch (error) {
      console.error('ShipStation sync error:', error);
      syncResult = { 
        success: false, 
        error: error instanceof Error ? error.message : 'ShipStation sync failed' 
      };
    }
    
    return NextResponse.json({
      orderId: orderId.toString(),
      notes: consolidatedNotes,
      syncResult
    });
    
  } catch (error) {
    console.error('Error syncing notes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
