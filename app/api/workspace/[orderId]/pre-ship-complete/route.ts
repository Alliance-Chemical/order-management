import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces, activityLog, documents } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';
import { tagSyncService } from '@/lib/services/shipstation/ensure-phase';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const sanitizeEnvValue = (value?: string | null) =>
  value ? value.replace(/[\r\n]+/g, '').trim() : undefined;

const awsRegion = sanitizeEnvValue(process.env.AWS_REGION) || 'us-east-2';
const awsAccessKeyId = sanitizeEnvValue(process.env.AWS_ACCESS_KEY_ID);
const awsSecretAccessKey = sanitizeEnvValue(process.env.AWS_SECRET_ACCESS_KEY);

// Initialize S3 client when credentials are present
const s3Client = awsAccessKeyId && awsSecretAccessKey
  ? new S3Client({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    })
  : null;

type PreShipPhotoInput = {
  base64?: string;
  lotNumbers?: string[];
  timestamp?: string;
};

type CheckedItem = Record<string, unknown>;

type UploadedPhoto = {
  id: string;
  s3Key: string;
  s3Url: string;
  lotNumbers: string[];
  capturedAt: string;
  documentId: string;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const params = await context.params;
    const { checkedItems, photos, completedAt, failureNotes } = await request.json() as {
      checkedItems?: CheckedItem[];
      photos: PreShipPhotoInput[];
      completedAt?: string;
      failureNotes?: string;
    };
    
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

    if (!s3Client) {
      return NextResponse.json(
        { error: 'AWS S3 is not configured' },
        { status: 500 }
      );
    }

    // Extract lot numbers from all photos
    const allLotNumbers = photos.reduce<string[]>((acc, photo) => {
      return [...acc, ...(photo.lotNumbers || [])];
    }, []);

    // Upload photos to S3 and store in documents table
    const uploadedPhotos: UploadedPhoto[] = [];
    const failedUploads: Array<{ name?: string; reason: string }> = [];
    for (const [index, photo] of photos.entries()) {
      if (photo.base64) {
        try {
          // Remove data URL prefix if present
          const base64Data = photo.base64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Generate unique filename
          const photoId = uuidv4();
          const key = `workspaces/${orderId}/pre-ship/${photoId}.jpg`;
          const bucketName = (process.env.S3_DOCUMENTS_BUCKET || 'alliance-chemical-documents').replace(/[\r\n]+/g, '').trim();
          
          // Upload to S3
          await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: 'image/jpeg',
            Metadata: {
              orderId: orderId.toString(),
              capturedAt: photo.timestamp || new Date().toISOString(),
              lotNumbers: JSON.stringify(photo.lotNumbers || [])
            }
          }));
          
          // Store document record in database
          const documentRecord = await db.insert(documents).values({
            workspaceId: workspace.id,
            documentType: 'pre_ship_photo',
            documentName: `Pre-ship Photo ${index + 1} - Order ${orderId}`,
            s3Bucket: bucketName,
            s3Key: key,
            s3Url: `https://${bucketName}.s3.amazonaws.com/${key}`,
            fileSize: buffer.length,
            mimeType: 'image/jpeg',
            uploadedBy: 'warehouse_worker'
          }).returning();
          
          uploadedPhotos.push({
            id: documentRecord[0].id,
            s3Key: key,
            s3Url: `https://${bucketName}.s3.amazonaws.com/${key}`,
            lotNumbers: photo.lotNumbers || [],
            capturedAt: photo.timestamp || new Date().toISOString(),
            documentId: documentRecord[0].id
          });
        } catch (uploadError) {
          console.error('Failed to upload photo:', uploadError);
          failedUploads.push({ name: `Photo ${index + 1}`, reason: uploadError instanceof Error ? uploadError.message : 'Upload failed' });
        }
      }
    }

    if (failedUploads.length > 0) {
      return NextResponse.json(
        { code: 'UPLOAD_FAILED', message: 'One or more photos failed to upload', failed: failedUploads },
        { status: 502 }
      );
    }

    // Update workspace with pre-ship inspection data
    const currentModuleStates = (workspace.moduleStates as Record<string, unknown> | undefined) || {};
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
    const currentPhaseCompleted = (workspace.phaseCompletedAt as Record<string, string> | undefined) || {};
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
