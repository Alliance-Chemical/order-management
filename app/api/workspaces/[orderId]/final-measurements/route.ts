import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';
import { ShipStationClient } from '@/lib/services/shipstation/client';

const repo = new WorkspaceRepository();
const ss = new ShipStationClient();

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
      measuredBy,
      measuredAt,
    } = body || {};

    if (!dimensions || !weight) {
      return NextResponse.json({ error: 'Missing dimensions or weight' }, { status: 400 });
    }

    const workspace = await repo.findByOrderId(orderId);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const finalMeasurements = {
      weight,
      dimensions,
      measuredBy: measuredBy || userId,
      measuredAt: measuredAt || new Date().toISOString(),
    } as any;

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
      const note = `Final dims/weight recorded: ${dimensions.length}x${dimensions.width}x${dimensions.height} ${dimensions.units}, ${weight.value} ${weight.units}. By ${finalMeasurements.measuredBy} at ${finalMeasurements.measuredAt}`;
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

