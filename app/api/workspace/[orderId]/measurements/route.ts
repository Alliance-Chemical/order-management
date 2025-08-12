import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces, activityLog } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = parseInt(params.orderId);
    const measurements = await request.json();

    // Find the workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, orderId),
    });

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Update the workspace with final measurements
    await db
      .update(workspaces)
      .set({
        finalMeasurements: measurements,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.orderId, orderId));

    // Create activity log entry
    await db.insert(activityLog).values({
      workspaceId: workspace.id,
      action: 'measurements_recorded',
      details: {
        weight: `${measurements.weight.value} ${measurements.weight.units}`,
        dimensions: `${measurements.dimensions.length} × ${measurements.dimensions.width} × ${measurements.dimensions.height} ${measurements.dimensions.units}`,
        scannedContainer: measurements.scannedContainer || 'Not scanned',
      },
      performedBy: measurements.measuredBy || 'System',
      performedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      measurements,
      message: 'Measurements saved successfully',
    });
  } catch (error) {
    console.error('Error saving measurements:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save measurements' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = parseInt(params.orderId);

    // Find the workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, orderId),
    });

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      measurements: workspace.finalMeasurements || null,
    });
  } catch (error) {
    console.error('Error fetching measurements:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch measurements' },
      { status: 500 }
    );
  }
}