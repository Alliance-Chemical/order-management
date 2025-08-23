import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';
import { asBigInt, jsonStringifyWithBigInt } from '@/lib/utils/bigint';
import { ShipStationClient } from '@/lib/services/shipstation/client';

const shipstation = new ShipStationClient();

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
    
    // Build consolidated notes from workspace data
    const notes = [];
    
    // Add inspection results
    if (workspace.moduleStates) {
      Object.entries(workspace.moduleStates).forEach(([phase, state]: [string, any]) => {
        if (state.result) {
          notes.push(`${phase}: ${state.result.toUpperCase()}`);
          if (state.notes) {
            notes.push(`  Notes: ${state.notes}`);
          }
        }
      });
    }
    
    // Add lot assignments
    const lots = workspace.shipstationData?.lots || [];
    if (lots.length > 0) {
      notes.push('\nLot Assignments:');
      lots.forEach((lot: any) => {
        notes.push(`  - ${lot.lotNumber}`);
      });
    }
    
    // Add any custom notes from request
    if (body.additionalNotes) {
      notes.push('\n' + body.additionalNotes);
    }
    
    const consolidatedNotes = notes.join('\n');
    
    // Push to ShipStation
    let syncResult = { success: false, error: null };
    
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
        .where(eq(workspaces.orderId, orderIdBigInt));
        
    } catch (error) {
      console.error('ShipStation sync error:', error);
      syncResult = { 
        success: false, 
        error: error instanceof Error ? error.message : 'ShipStation sync failed' 
      };
    }
    
    return new NextResponse(jsonStringifyWithBigInt({
      orderId: orderId.toString(),
      notes: consolidatedNotes,
      syncResult
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error syncing notes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}