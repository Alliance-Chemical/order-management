import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';
import { ShipStationClient } from '@/lib/services/shipstation/client';

const repo = new WorkspaceRepository();
const ss = new ShipStationClient();

type Dimensions = { length: number; width: number; height: number; units: string };
type Weight = { value: number; units: string };
type Pallet = { id?: string; weight: Weight; dimensions?: Dimensions; [k: string]: unknown };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId: orderIdStr } = await params;
    const orderId = parseInt(orderIdStr);
    const userId = request.headers.get('x-user-id') || 'worker';
    const body = await request.json();

    const {
      dimensions, // { length, width, height, units }
      weight,     // { value, units }
      pallets,    // Array of pallet configurations
      mode,       // 'single' or 'pallets'
      palletCount,
      totalWeight,
      measuredBy,
      measuredAt,
    } = body || {};

    // Validate based on mode
    if (mode === 'pallets') {
      if (!pallets || pallets.length === 0) {
        return NextResponse.json({ error: 'Missing pallet configurations' }, { status: 400 });
      }
    } else if (!dimensions || !weight) {
      return NextResponse.json({ error: 'Missing dimensions or weight' }, { status: 400 });
    }

    const workspace = await repo.findByOrderId(orderId);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const finalMeasurements = {
      ...(mode === 'pallets' ? {
        pallets: (pallets as Pallet[]),
        mode: 'pallets',
        palletCount: palletCount || (Array.isArray(pallets) ? pallets.length : 0),
        totalWeight: totalWeight || (Array.isArray(pallets) ? pallets.reduce((sum: number, p: Pallet) => sum + (p.weight?.value ?? 0), 0) : 0),
      } : {
        weight: weight as Weight,
        dimensions: dimensions as Dimensions,
        mode: 'single',
      }),
      measuredBy: measuredBy || userId,
      measuredAt: measuredAt || new Date().toISOString(),
    };

    await repo.update(workspace.id, {
      finalMeasurements,
      updatedBy: userId,
    });

    await repo.logActivity({
      workspaceId: workspace.id,
      activityType: 'final_measurements_recorded',
      performedBy: userId,
      metadata: finalMeasurements,
    });

    // Append to ShipStation internal notes
    try {
      let note = '';
      if (mode === 'pallets') {
        note = `Pallet arrangement recorded: ${palletCount || pallets.length} pallets, total weight ${totalWeight || 0} lbs. By ${finalMeasurements.measuredBy} at ${finalMeasurements.measuredAt}`;
      } else {
        note = `Final dims/weight recorded: ${dimensions.length}x${dimensions.width}x${dimensions.height} ${dimensions.units}, ${weight.value} ${weight.units}. By ${finalMeasurements.measuredBy} at ${finalMeasurements.measuredAt}`;
      }
      await ss.appendInternalNotes(orderId, note);
    } catch (e) {
      console.warn('Failed to append ShipStation internal notes:', e);
    }

    return NextResponse.json({ success: true, finalMeasurements });
  } catch (error) {
    console.error('Error saving final measurements:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
