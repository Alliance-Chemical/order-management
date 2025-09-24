import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, getS3BucketName, createOrderFolderPath } from '@/lib/aws/s3-client';
import { resolveDocumentName } from '@/lib/utils/document-name';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';
import { v4 as uuidv4 } from 'uuid';

const repository = new WorkspaceRepository();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const orderId = formData.get('orderId') as string;
    const orderNumber = formData.get('orderNumber') as string;
    const documentType = formData.get('documentType') as string || 'other';

    if (!file || !orderId || !orderNumber) {
      return NextResponse.json(
        { error: 'File, orderId, and orderNumber are required' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Get workspace
    const workspace = await repository.findByOrderId(parseInt(orderId));
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Generate S3 key
    const fileExtension = file.name.split('.').pop();
    const fileName = `${documentType}-${uuidv4()}.${fileExtension}`;
    const s3Key = `${createOrderFolderPath(orderNumber)}documents/${fileName}`;
    const documentName = resolveDocumentName(file.name, s3Key);

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to S3
    const bucketName = getS3BucketName();
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        orderId: orderId.toString(),
        orderNumber,
        documentType,
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(uploadCommand);

    // Save document record to database
    const document = await repository.addDocument({
      workspaceId: workspace.id,
      documentType,
      documentName,
      s3Bucket: bucketName,
      s3Key,
      s3Url: `https://${bucketName}.s3.us-east-2.amazonaws.com/${s3Key}`,
      fileSize: file.size,
      mimeType: file.type,
      uploadedBy: 'system', // Replace with actual user
    });

    // Update workspace documents JSONB
    const currentDocs = workspace.documents || { coa: [], sds: [], other: [] };
    if (currentDocs[documentType]) {
      currentDocs[documentType].push(document.id);
    } else {
      currentDocs.other.push(document.id);
    }

    await repository.updateWorkspace(workspace.id, {
      documents: currentDocs,
      totalDocumentSize: (workspace.totalDocumentSize || 0) + file.size,
    });

    // Log activity
    await repository.logActivity({
      workspaceId: workspace.id,
      activityType: 'document_uploaded',
      activityDescription: `Uploaded ${documentType} document: ${documentName}`,
      performedBy: 'system',
      module: 'documents',
      metadata: {
        documentId: document.id,
        documentType,
        documentName,
        fileSize: file.size,
      },
    });

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
      name: documentName,
        type: documentType,
        size: file.size,
        url: document.s3Url,
        uploadedAt: document.uploadedAt,
      },
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
