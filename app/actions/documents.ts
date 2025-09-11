'use server'

import { WorkspaceService } from '@/lib/services/workspace/service'
import { getOptimizedDb } from '@/lib/db/neon'
import { documents, workspaces } from '@/lib/db/schema/qr-workspace'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const workspaceService = new WorkspaceService()

// Initialize S3 client if AWS credentials are configured
const s3Client = process.env.AWS_ACCESS_KEY_ID ? new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
}) : null

export async function uploadDocument(data: {
  file: File
  orderId: string
  documentType: string
  metadata?: any
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

    // Upload to S3 if configured
    if (s3Client && process.env.AWS_S3_BUCKET) {
      const buffer = Buffer.from(await file.arrayBuffer())
      s3Key = `workspaces/${orderId}/documents/${Date.now()}-${file.name}`
      
      const uploadCommand = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type,
        Metadata: {
          workspaceId: workspace.id.toString(),
          orderId: orderId,
          documentType: documentType
        }
      })

      await s3Client.send(uploadCommand)
      
      // Generate presigned URL for access
      const getCommand = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: s3Key
      })
      
      documentUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 * 24 * 7 }) // 7 days
    } else {
      // Fallback: store as base64 in database (not recommended for production)
      const buffer = Buffer.from(await file.arrayBuffer())
      documentUrl = `data:${file.type};base64,${buffer.toString('base64')}`
    }

    // Save document record to database
    const db = getOptimizedDb()
    const [document] = await db
      .insert(documents)
      .values({
        workspaceId: workspace.id,
        documentType,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        s3Key,
        documentUrl,
        metadata: metadata || {},
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
        fileName: file.name
      }
    })

    // Revalidate workspace page
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      document: {
        id: document.id,
        fileName: document.fileName,
        documentType: document.documentType,
        url: document.documentUrl
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
  metadata?: any
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
    const db = getOptimizedDb()
    const [document] = await db
      .insert(documents)
      .values({
        workspaceId: workspace.id,
        documentType,
        fileName,
        documentUrl: finalUrl,
        metadata: metadata || {},
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
        fileName
      }
    })

    // Revalidate workspace page
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      document: {
        id: document.id,
        fileName: document.fileName,
        documentType: document.documentType,
        url: document.documentUrl
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
        if (doc.s3Key && s3Client && process.env.AWS_S3_BUCKET) {
          const getCommand = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
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

    return {
      success: true,
      documents: documentsWithUrls
    }
  } catch (error) {
    console.error('Error fetching documents:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch documents'
    }
  }
}

export async function deleteDocument(documentId: number, orderId: string) {
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
    if (doc.s3Key && s3Client && process.env.AWS_S3_BUCKET) {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
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
        fileName: doc.fileName,
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