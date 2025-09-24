'use server'

import { WorkspaceService } from '@/lib/services/workspace/service'
import { getOptimizedDb } from '@/lib/db/neon'
import { documents, workspaces } from '@/lib/db/schema/qr-workspace'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { resolveDocumentName } from '@/lib/utils/document-name'
import {
  validateImageFile,
  uploadToS3WithRetry,
  generateS3Key
} from '@/lib/utils/upload-helpers'

const workspaceService = new WorkspaceService()

// Initialize S3 client if AWS credentials are configured
const sanitizeEnvValue = (value?: string | null) =>
  value ? value.replace(/[\r\n]+/g, '').trim() : undefined

const awsAccessKeyId = sanitizeEnvValue(process.env.AWS_ACCESS_KEY_ID)
const awsSecretAccessKey = sanitizeEnvValue(process.env.AWS_SECRET_ACCESS_KEY)
const awsRegion = sanitizeEnvValue(process.env.AWS_REGION) || 'us-east-2'

const s3Client = awsAccessKeyId && awsSecretAccessKey ? new S3Client({
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey
  }
}) : null

const s3DocumentsBucket = sanitizeEnvValue(
  process.env.S3_DOCUMENTS_BUCKET ||
  process.env.AWS_S3_BUCKET ||
  process.env.S3_BUCKET_NAME ||
  null
)

type DocumentMetadata = Record<string, unknown>;

export async function uploadDocument(data: {
  file: File
  orderId: string
  documentType: string
  metadata?: DocumentMetadata
}) {
  try {
    const { file, orderId, documentType, metadata } = data
    
    // Find workspace
    const workspace = await workspaceService.repository.findByOrderId(Number(orderId))
    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    let documentUrl = ''
    let s3Key = ''
    let bucketUsed = s3DocumentsBucket || 'inline-storage'
    let storedS3Url: string | null = null

    // Upload to S3 if configured
    if (s3Client && s3DocumentsBucket) {
      try {
        // Validate file before upload
        validateImageFile(file);

        const buffer = Buffer.from(await file.arrayBuffer())
        s3Key = generateS3Key(orderId, documentType, file.name);

        // Upload with retry logic and progress tracking
        const uploadResult = await uploadToS3WithRetry(s3Client, {
          bucket: s3DocumentsBucket,
          key: s3Key,
          body: buffer,
          contentType: file.type,
          metadata: {
            workspaceId: workspace.id.toString(),
            orderId: orderId,
            documentType: documentType,
            originalName: file.name,
            uploadedAt: new Date().toISOString()
          }
        });

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Upload failed');
        }

        documentUrl = uploadResult.url!;
        storedS3Url = uploadResult.s3Url!;
        bucketUsed = s3DocumentsBucket;

        if (uploadResult.retries && uploadResult.retries > 0) {
          console.log(`Document uploaded to S3 after ${uploadResult.retries} retries`);
        }
      } catch (uploadError) {
        console.error('S3 upload failed, falling back to inline storage:', uploadError);

        // Fallback to inline storage if S3 fails
        const buffer = Buffer.from(await file.arrayBuffer())
        documentUrl = `data:${file.type};base64,${buffer.toString('base64')}`
        s3Key = `inline/${orderId}/${Date.now()}-${file.name}`
        bucketUsed = 'inline-storage-fallback'
        storedS3Url = documentUrl
      }
    } else {
      // Fallback: store as base64 in database (not recommended for production)
      const buffer = Buffer.from(await file.arrayBuffer())
      documentUrl = `data:${file.type};base64,${buffer.toString('base64')}`
      s3Key = `inline/${orderId}/${Date.now()}-${file.name}`
      bucketUsed = 'inline-storage'
      storedS3Url = documentUrl
    }

    const documentName = resolveDocumentName(file.name, s3Key)

    // Save document record to database
    const db = getOptimizedDb()
    const [document] = await db
      .insert(documents)
      .values({
        workspaceId: workspace.id,
        documentType,
        documentName,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        s3Bucket: bucketUsed,
        s3Key,
        s3Url: storedS3Url,
        uploadedBy: 'system'
      })
      .returning()

    // Log activity
    await workspaceService.repository.logActivity({
      workspaceId: workspace.id,
      activityType: 'document_uploaded',
      performedBy: 'system',
      metadata: {
        documentId: document.id,
        documentType,
        documentName
      }
    })

    // Revalidate workspace page
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      document: {
        id: document.id,
        fileName: document.documentName,
        documentName,
        documentType: document.documentType,
        url: documentUrl,
        s3Url: document.s3Url
      }
    }
  } catch (error) {
    console.error('Error uploading document:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload document'
    }
  }
}

export async function addWorkspaceDocument(data: {
  orderId: string
  documentType: string
  fileName: string
  documentUrl?: string
  content?: string
  metadata?: DocumentMetadata
}) {
  try {
    const { orderId, documentType, fileName, documentUrl, content, metadata } = data
    
    // Find workspace
    const workspace = await workspaceService.repository.findByOrderId(Number(orderId))
    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    // If content is provided, create a data URL
    let finalUrl = documentUrl
    if (content && !documentUrl) {
      finalUrl = `data:text/plain;base64,${Buffer.from(content).toString('base64')}`
    }

    // Save document record
    const bucketForDoc = s3DocumentsBucket || 'external-resource'
    const keyForDoc = `external/${orderId}/${Date.now()}-${fileName.replace(/\s+/g, '-')}`
    const documentName = resolveDocumentName(fileName, keyForDoc)
    const mimeFromUrl = finalUrl?.startsWith('data:')
      ? finalUrl.match(/^data:(.*?);/)?.[1]
      : undefined
    const fileSize = content
      ? Buffer.byteLength(content)
      : finalUrl
        ? Buffer.byteLength(finalUrl)
        : 0

    const db = getOptimizedDb()
    const [document] = await db
      .insert(documents)
      .values({
        workspaceId: workspace.id,
        documentType,
        documentName,
        s3Bucket: bucketForDoc,
        s3Key: keyForDoc,
        s3Url: finalUrl || null,
        fileSize,
        mimeType: (metadata?.['mimeType'] as string | undefined) || mimeFromUrl || 'application/octet-stream',
        uploadedBy: 'system'
      })
      .returning()

    // Log activity
    await workspaceService.repository.logActivity({
      workspaceId: workspace.id,
      activityType: 'document_added',
      performedBy: 'system',
      metadata: {
        documentId: document.id,
        documentType,
        documentName
      }
    })

    // Revalidate workspace page
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      document: {
        id: document.id,
        fileName: document.documentName,
        documentName,
        documentType: document.documentType,
        url: finalUrl ?? document.s3Url ?? undefined,
        s3Url: document.s3Url
      }
    }
  } catch (error) {
    console.error('Error adding document:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add document'
    }
  }
}

export async function getWorkspaceDocuments(orderId: string) {
  try {
    const workspace = await workspaceService.repository.findByOrderId(Number(orderId))
    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    const db = getOptimizedDb()
    const docs = await db.query.documents.findMany({
      where: eq(documents.workspaceId, workspace.id)
    })

    // Refresh presigned URLs if using S3
    const documentsWithUrls = await Promise.all(
      docs.map(async (doc) => {
        const bucketForDoc = doc.s3Bucket || s3DocumentsBucket

        if (doc.s3Key && s3Client && bucketForDoc) {
          const getCommand = new GetObjectCommand({
            Bucket: bucketForDoc,
            Key: doc.s3Key
          })
          
          const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 * 24 }) // 24 hours
          
          return {
            ...doc,
            documentUrl: url
          }
        }
        return doc
      })
    )

    const normalizedDocuments = documentsWithUrls.map((doc: any) => ({
      ...doc,
      fileName: doc.documentName ?? doc.fileName,
      documentUrl: doc.documentUrl ?? doc.s3Url
    }))

    return {
      success: true,
      documents: normalizedDocuments
    }
  } catch (error) {
    console.error('Error fetching documents:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch documents'
    }
  }
}

export async function deleteDocument(documentId: string) {
  try {
    const db = getOptimizedDb()
    const [document] = await db
      .delete(documents)
      .where(eq(documents.id, documentId))
      .returning()

    if (!document) {
      return { success: false, error: 'Document not found' }
    }

    const bucketForDoc = document.s3Bucket || s3DocumentsBucket

    if (document.s3Key && s3Client && bucketForDoc) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: bucketForDoc,
          Key: document.s3Key,
        })
        await s3Client.send(deleteCommand)
      } catch (error) {
        console.error('Failed to delete S3 object for document', documentId, error)
      }
    }

    let workspacePath: string | null = null
    if (document.workspaceId) {
      const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.id, document.workspaceId) })
      if (workspace) {
        workspacePath = `/workspace/${workspace.orderId}`
        await workspaceService.repository.logActivity({
          workspaceId: workspace.id,
          activityType: 'document_deleted',
          performedBy: 'system',
          metadata: {
            documentId,
            documentType: document.documentType,
            documentName: document.documentName,
          },
        })
      }
    }

    if (workspacePath) {
      revalidatePath(workspacePath)
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting document:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete document',
    }
  }
}

export async function deleteWorkspaceDocument(documentId: number, orderId: string) {
  try {
    const db = getOptimizedDb()
    
    // Get document details
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId)
    })

    if (!doc) {
      return {
        success: false,
        error: 'Document not found'
      }
    }

    // Delete from S3 if applicable
    const bucketForDoc = doc.s3Bucket || s3DocumentsBucket

    if (doc.s3Key && s3Client && bucketForDoc) {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucketForDoc,
        Key: doc.s3Key
      })
      
      await s3Client.send(deleteCommand)
    }

    // Delete from database
    await db
      .delete(documents)
      .where(eq(documents.id, documentId))

    // Log activity
    await workspaceService.repository.logActivity({
      workspaceId: doc.workspaceId,
      activityType: 'document_deleted',
      performedBy: 'system',
      metadata: {
        documentId,
        documentName: doc.documentName,
        documentType: doc.documentType
      }
    })

    // Revalidate workspace page
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      message: 'Document deleted successfully'
    }
  } catch (error) {
    console.error('Error deleting document:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete document'
    }
  }
}
