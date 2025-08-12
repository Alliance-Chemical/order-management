import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { batchHistory, qrCodes, activityLog } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      workspaceId,
      orderId,
      batchNumber,
      chemicalName,
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
      initialSpecificGravity
    } = body;

    // Validate required fields
    if (!batchNumber || !chemicalName || !completedBy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Insert batch history record
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
    }).returning();

    // Generate QR code for the batch
    if (orderId) {
      const qrData = {
        type: 'batch',
        batchId: batchNumber,
        orderId,
        chemicalName,
        concentration: `${desiredConcentration}%`,
        quantity: `${totalVolumeGallons} gal`,
        createdBy: completedBy,
        sourceConcentration: `${initialConcentration}%`,
        dilutionPerformed: true
      };

      const [newQR] = await db.insert(qrCodes).values({
        workspaceId: workspaceId || null,
        qrType: 'batch',
        code: batchNumber,
        encodedData: qrData,
        metadata: {
          chemicalName,
          desiredConcentration,
          totalVolumeGallons,
          completedBy
        }
      }).returning();

      // Update batch history with QR code reference
      await db.update(batchHistory)
        .set({ qrCodeId: newQR.id })
        .where(eq(batchHistory.id, newBatch.id));

      // Log activity if workspace exists
      if (workspaceId) {
        await db.insert(activityLog).values({
          workspaceId,
          activityType: 'dilution_performed',
          metadata: {
            batchNumber,
            chemicalName,
            initialConcentration: `${initialConcentration}%`,
            desiredConcentration: `${desiredConcentration}%`,
            totalVolume: `${totalVolumeGallons} gal`
          },
          performedBy: completedBy,
          performedAt: new Date()
        });
      }
    }

    return NextResponse.json({
      success: true,
      batch: newBatch,
      message: 'Batch saved successfully'
    });

  } catch (error) {
    console.error('Error saving batch:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save batch' },
      { status: 500 }
    );
  }
}