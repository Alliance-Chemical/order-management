import { NextRequest, NextResponse } from 'next/server';
import { getEdgeDb, withEdgeRetry } from '@/lib/db/neon-edge';
import { batchHistory, qrCodes, activityLog } from '@/lib/db/schema/qr-workspace';
import { eq, inArray } from 'drizzle-orm';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getEdgeDb();
    const {
      workspaceId,
      orderId,
      batchNumber,
      chemicalName,
      chemicalId,
      shopifyProductId,
      shopifyTitle,
      shopifySKU,
      initialConcentration,
      desiredConcentration,
      totalVolumeGallons,
      chemicalVolumeGallons,
      waterVolumeGallons,
      chemicalWeightLbs,
      waterWeightLbs,
      notes,
      completedBy,
      methodUsed,
      initialSpecificGravity,
      hazardClass,
      ppeSuggestion,
      destinationQrShortCodes // Array of short codes from the dilution calculator
    } = body;

    // Validate required fields
    if (!batchNumber || !chemicalName || !completedBy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Look up destination QR codes by short codes if provided
    let destinationQrIds: string[] = [];
    if (destinationQrShortCodes && destinationQrShortCodes.length > 0) {
      const destinationQrs = await db
        .select({ id: qrCodes.id })
        .from(qrCodes)
        .where(inArray(qrCodes.shortCode, destinationQrShortCodes));
      
      destinationQrIds = destinationQrs.map(qr => qr.id);
      
      console.log('[Batch Save] Found destination QR IDs:', destinationQrIds, 'from short codes:', destinationQrShortCodes);
    }

    // Insert batch history record with destination QR links
    const [newBatch] = await db.insert(batchHistory).values({
      workspaceId: workspaceId || null,
      batchNumber,
      chemicalName,
      initialConcentration: initialConcentration.toString(),
      desiredConcentration: desiredConcentration.toString(),
      totalVolumeGallons: totalVolumeGallons.toString(),
      chemicalVolumeGallons: chemicalVolumeGallons.toString(),
      waterVolumeGallons: waterVolumeGallons.toString(),
      chemicalWeightLbs: chemicalWeightLbs.toString(),
      waterWeightLbs: waterWeightLbs.toString(),
      notes: notes || null,
      completedBy,
      methodUsed,
      initialSpecificGravity: initialSpecificGravity.toString(),
      destinationQrIds, // Store the array of destination QR IDs
    }).returning();

    // Log activity if workspace exists (NO QR code generation)
    if (workspaceId) {
      await db.insert(activityLog).values({
        workspaceId,
        activityType: 'dilution_performed',
        metadata: {
          batchNumber,
          chemicalName,
          initialConcentration: `${initialConcentration}%`,
          desiredConcentration: `${desiredConcentration}%`,
          totalVolume: `${totalVolumeGallons} gal`,
          destinationContainers: destinationQrShortCodes || [],
          shopifyProductId,
          hazardClass
        },
        performedBy: completedBy,
        performedAt: new Date()
      });
    }

    console.log('[Batch Save] Successfully saved batch:', newBatch.id, 'linked to destination QRs:', destinationQrIds);

    return NextResponse.json({
      success: true,
      batch: newBatch,
      message: 'Batch saved successfully and linked to destination containers'
    });

  } catch (error) {
    console.error('Error saving batch:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save batch' },
      { status: 500 }
    );
  }
}