import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces, activityLog } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';
import { sendMeasurementNotificationEmail } from '@/lib/services/email/microsoft-graph';
import { normalizeFinalMeasurementsPayload, buildMeasurementSummary } from '@/lib/measurements/normalize';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const params = await context.params;
    const orderId = parseInt(params.orderId);
    const userIdFromHeader = request.headers.get('x-user-id') || 'worker';
    const rawPayload = await request.json();

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

    const normalizedMeasurements = normalizeFinalMeasurementsPayload(rawPayload, {
      userId:
        typeof rawPayload?.measuredBy === 'string' && rawPayload.measuredBy.trim().length
          ? rawPayload.measuredBy.trim()
          : userIdFromHeader,
      timestamp: typeof rawPayload?.measuredAt === 'string' ? rawPayload.measuredAt : undefined,
    });

    if (
      normalizedMeasurements.mode === 'pallets' &&
      (!normalizedMeasurements.pallets || normalizedMeasurements.pallets.length === 0)
    ) {
      return NextResponse.json(
        { success: false, error: 'Missing pallet configurations' },
        { status: 400 }
      );
    }

    if (
      normalizedMeasurements.mode === 'single' &&
      (!normalizedMeasurements.weight || !normalizedMeasurements.dimensions)
    ) {
      return NextResponse.json(
        { success: false, error: 'Missing dimensions or weight' },
        { status: 400 }
      );
    }

    const previousMeasurements = workspace.finalMeasurements as any;

    // Update the workspace with final measurements
    await db
      .update(workspaces)
      .set({
        finalMeasurements: normalizedMeasurements,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.orderId, orderId));

    // Create activity log entry with explicit field mapping to avoid compilation issues
    const { dimensionsSummary, weightSummary } = buildMeasurementSummary(normalizedMeasurements);
    const logEntry = {
      workspaceId: workspace.id,
      activityType: 'measurements_recorded' as const,
      activityDescription: `Recorded measurements: ${weightSummary}, ${dimensionsSummary}`,
      performedBy: normalizedMeasurements.measuredBy || 'System',
      performedAt: new Date(),
      module: 'warehouse' as const,
      metadata: {
        weight: weightSummary,
        dimensions: dimensionsSummary,
        scannedContainer:
          normalizedMeasurements.scannedContainer ?? 'Not scanned',
      },
      changes: {},
    };

    // Validate required fields before insert
    if (!logEntry.activityType || !logEntry.workspaceId || !logEntry.performedBy) {
      console.error('Missing required fields for activity log:', logEntry);
      // Continue without logging to avoid blocking the measurement save
    } else {
      await db.insert(activityLog).values(logEntry);
    }

    const shouldNotify = !(
      previousMeasurements?.weight?.value &&
      previousMeasurements?.dimensions?.length &&
      previousMeasurements?.dimensions?.width &&
      previousMeasurements?.dimensions?.height
    );

    if (
      shouldNotify &&
      normalizedMeasurements.weight &&
      normalizedMeasurements.dimensions
    ) {
      // Fire and forget email notification - don't let it fail the save
      sendMeasurementNotificationEmail({
        orderId,
        orderNumber: workspace.orderNumber,
        measurements: normalizedMeasurements,
      }).catch((notificationError) => {
        console.error('Failed to send measurement notification email:', notificationError);
        // Don't throw - we still want to save the measurements
      });
    }

    return NextResponse.json({
      success: true,
      measurements: normalizedMeasurements,
      message: 'Measurements saved successfully',
    });
  } catch (error) {
    console.error('Error saving measurements:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to save measurements';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const params = await context.params;
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
