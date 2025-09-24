import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';
import { uploadToS3, getPresignedUrl } from '@/lib/aws/s3-client';
import { resolveDocumentName } from '@/lib/utils/document-name';
import { v4 as uuidv4 } from 'uuid';

const repository = new WorkspaceRepository();

type DocumentIdBucketMap = {
  coa?: string[];
  sds?: string[];
  other?: string[];
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const params = await context.params;
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('type') as string;
    const userId = formData.get('userId') as string || 'system';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const orderId = parseInt(params.orderId);
    const workspace = await repository.findByOrderId(orderId);
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Prepare file for upload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Generate S3 key
    const fileExtension = file.name.split('.').pop();
    const s3Key = `${workspace.orderNumber}/${documentType}/${uuidv4()}.${fileExtension}`;
    const documentName = resolveDocumentName(file.name, s3Key);
    
    // Upload to S3
    await uploadToS3(workspace.s3BucketName!, s3Key, buffer, file.type);
    
    // Get presigned URL
    const presignedUrl = await getPresignedUrl(workspace.s3BucketName!, s3Key);
    
    // Save document record
    const document = await repository.addDocument({
      workspaceId: workspace.id,
      documentType,
      documentName,
      s3Bucket: workspace.s3BucketName!,
      s3Key,
      s3Url: presignedUrl,
      fileSize: file.size,
      mimeType: file.type,
      uploadedBy: userId,
    });

    // Update workspace documents
    const currentDocs: DocumentIdBucketMap = {
      coa: [],
      sds: [],
      other: [],
      ...(workspace.documents as DocumentIdBucketMap | undefined),
    };

    if (documentType in currentDocs) {
      const key = documentType as keyof DocumentIdBucketMap;
      const bucket = currentDocs[key] ?? [];
      bucket.push(document.id);
      currentDocs[key] = bucket;
    }
    
    await repository.update(workspace.id, {
      documents: currentDocs,
      totalDocumentSize: (workspace.totalDocumentSize || 0) + file.size,
    });

    // Log activity
    await repository.logActivity({
      workspaceId: workspace.id,
      activityType: 'document_uploaded',
      performedBy: userId,
      metadata: {
        documentType,
        documentName,
        fileSize: file.size,
      },
    });

    return NextResponse.json({
      id: document.id,
      name: documentName,
      type: document.documentType,
      url: presignedUrl,
      size: document.fileSize,
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const params = await context.params;
    const orderId = parseInt(params.orderId);
    const workspace = await repository.findByOrderId(orderId);
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const documents = await repository.getDocumentsByWorkspace(workspace.id);
    
    // Generate presigned URLs for all documents
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => ({
        ...doc,
        url: await getPresignedUrl(doc.s3Bucket, doc.s3Key),
      }))
    );

    return NextResponse.json(documentsWithUrls);
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
