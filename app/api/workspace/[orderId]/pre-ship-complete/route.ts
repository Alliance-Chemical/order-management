import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces, activityLog } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';
import { tagSyncService } from '@/lib/services/shipstation/ensure-phase';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { checkedItems, photos, completedAt, failureNotes } = await request.json();
    
    const orderId = params.orderId;
    
    // Get the current workspace
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, Number(orderId)))
      .limit(1);
      
    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Extract lot numbers from all photos
    const allLotNumbers = photos.reduce((acc: string[], photo: any) => {
      return [...acc, ...(photo.lotNumbers || [])];
    }, []);

    // Upload photos to S3 if they exist
    const uploadedPhotos = [];
    for (const photo of photos) {
      if (photo.base64) {
        try {
          // Remove data URL prefix if present
          const base64Data = photo.base64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Generate unique filename
          const photoId = uuidv4();
          const key = `workspaces/${orderId}/pre-ship/${photoId}.jpg`;
          
          // Upload to S3
          await s3Client.send(new PutObjectCommand({
            Bucket: process.env.S3_DOCUMENTS_BUCKET || 'alliance-chemical-documents',
            Key: key,
            Body: buffer,
            ContentType: 'image/jpeg',
            Metadata: {
              orderId: orderId.toString(),
              capturedAt: new Date().toISOString(),
              lotNumbers: JSON.stringify(photo.lotNumbers || [])
            }
          }));
          
          uploadedPhotos.push({
            s3Key: key,
            s3Url: `https://${process.env.S3_DOCUMENTS_BUCKET}.s3.amazonaws.com/${key}`,
            lotNumbers: photo.lotNumbers || [],
            capturedAt: new Date().toISOString()
          });
        } catch (uploadError) {
          console.error('Failed to upload photo:', uploadError);
        }
      }
    }

    // Update workspace with pre-ship inspection data
    const currentModuleStates = workspace.moduleStates as any || {};
    const updatedModuleStates = {
      ...currentModuleStates,
      preShip: {
        completed: true,
        checkedItems,
        photos: uploadedPhotos,
        lotNumbers: allLotNumbers,
        completedAt,
        completedBy: 'worker', // In production, get from auth
        failureNotes: failureNotes || null
      }
    };

    // Update phase completed timestamp
    const currentPhaseCompleted = workspace.phaseCompletedAt as any || {};
    const updatedPhaseCompleted = {
      ...currentPhaseCompleted,
      pre_ship: new Date().toISOString()
    };

    await db
      .update(workspaces)
      .set({
        moduleStates: updatedModuleStates,
        phaseCompletedAt: updatedPhaseCompleted,
        status: 'ready_to_ship',
        workflowPhase: 'ready_to_ship',
        updatedAt: new Date()
      })
      .where(eq(workspaces.orderId, Number(orderId)));

    // Log the activity
    await db.insert(activityLog).values({
      workspaceId: workspace.id,
      activityType: 'pre_ship_inspection_completed',
      activityDescription: `Pre-ship inspection completed. ${allLotNumbers.length} lot numbers captured. ${uploadedPhotos.length} photos uploaded.`,
      performedBy: 'worker',
      module: 'warehouse',
      metadata: {
        checkedItems,
        lotNumbers: allLotNumbers,
        photoCount: uploadedPhotos.length,
        failureNotes
      }
    });

    // Update ShipStation tags to mark as ready to ship
    const tagResult = await tagSyncService.ensurePhase(
      Number(orderId),
      'ready_to_ship',
      'pre_ship_inspection'
    );

    if (!tagResult.success) {
      console.error('Failed to update ShipStation tags:', tagResult.error);
    }

    // Send notification that pre-ship inspection is complete (if notification endpoint exists)
    try {
      const notifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/workspace/${orderId}/notify`;
      await fetch(notifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pre_ship_complete',
          message: `Pre-ship inspection completed. ${allLotNumbers.length} lot numbers captured.`,
          lotNumbers: allLotNumbers
        })
      });
    } catch (notifyError) {
      console.log('Notification endpoint not available:', notifyError);
    }

    return NextResponse.json({
      success: true,
      lotNumbers: allLotNumbers,
      photosUploaded: uploadedPhotos.length,
      message: 'Pre-ship inspection completed successfully',
      shipstationTagsUpdated: tagResult.success
    });

  } catch (error) {
    console.error('Error completing pre-ship inspection:', error);
    return NextResponse.json(
      { error: 'Failed to save pre-ship inspection' },
      { status: 500 }
    );
  }
}