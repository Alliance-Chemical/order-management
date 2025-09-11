'use server'

import { QRGenerator } from '@/src/services/qr/qrGenerator'
import { WorkspaceRepository } from '@/lib/services/workspace/repository'
import { getOptimizedDb } from '@/lib/db/neon'
import { qrCodes, workspaces } from '@/lib/db/schema/qr-workspace'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import QRCode from 'qrcode'

const qrGenerator = new QRGenerator()
const repository = new WorkspaceRepository()

export async function generateQR(data: {
  orderId: string
  orderNumber: string
  type?: string
  containerNumber?: number
  chemicalName?: string
}) {
  try {
    const { orderId, orderNumber, type = 'master', containerNumber, chemicalName } = data

    if (!orderId || !orderNumber) {
      return {
        success: false,
        error: 'Order ID and order number are required'
      }
    }

    // Generate QR data
    const qrData = qrGenerator.createQRData(orderId, orderNumber, type, containerNumber, chemicalName)
    const qrCode = await qrGenerator.generateQRCode(qrData)
    const shortCode = qrGenerator.generateShortCode(orderId, containerNumber)
    const qrUrl = qrGenerator.createQRUrl(qrData)

    // Find workspace
    const workspace = await repository.findByOrderId(orderId)
    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    // Save QR code to database
    const savedQR = await repository.addQRCode({
      workspaceId: workspace.id,
      qrType: type,
      qrCode: shortCode, // Store the short code as the unique identifier
      shortCode,
      orderId,
      orderNumber,
      containerNumber,
      chemicalName,
      encodedData: qrData,
      qrUrl,
    })

    // Revalidate workspace page
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      qr: {
        id: savedQR.id,
        qrCode,
        shortCode,
        url: qrUrl,
      }
    }
  } catch (error) {
    console.error('Error generating QR code:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate QR code'
    }
  }
}

export async function regenerateQRCodes(orderId: string, items: any[]) {
  try {
    const db = getOptimizedDb()
    
    // Find workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, BigInt(orderId))
    })

    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    // Delete existing QR codes for this workspace
    await db
      .delete(qrCodes)
      .where(eq(qrCodes.workspaceId, workspace.id))

    // Generate new QR codes
    const generatedQRs = []
    
    for (const item of items) {
      const labelCount = item.labelCount || 1
      
      for (let i = 0; i < labelCount; i++) {
        const containerNumber = items.indexOf(item) + i + 1
        const qrData = qrGenerator.createQRData(
          orderId,
          workspace.orderNumber,
          'container',
          containerNumber,
          item.name
        )
        
        const qrCode = await qrGenerator.generateQRCode(qrData)
        const shortCode = qrGenerator.generateShortCode(orderId, containerNumber)
        const qrUrl = qrGenerator.createQRUrl(qrData)

        // Save to database
        const savedQR = await db
          .insert(qrCodes)
          .values({
            workspaceId: workspace.id,
            qrType: 'container',
            qrCode: shortCode,
            shortCode,
            encodedData: qrData,
            scanCount: 0
          })
          .returning()

        generatedQRs.push({
          id: savedQR[0].id,
          qrCode,
          shortCode,
          url: qrUrl,
          itemName: item.name,
          sku: item.sku
        })
      }
    }

    // Revalidate workspace page
    revalidatePath(`/workspace/${orderId}`)

    return {
      success: true,
      qrCodes: generatedQRs
    }
  } catch (error) {
    console.error('Error regenerating QR codes:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to regenerate QR codes'
    }
  }
}

export async function printQR(qrCodes: string[]) {
  try {
    // Generate print-ready QR codes
    const printData = await Promise.all(
      qrCodes.map(async (code) => {
        const qrImage = await QRCode.toDataURL(code, {
          width: 400,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })
        
        return {
          code,
          image: qrImage
        }
      })
    )

    return {
      success: true,
      printData
    }
  } catch (error) {
    console.error('Error preparing QR codes for print:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to prepare QR codes for print'
    }
  }
}

export async function validateQR(qrCode: string) {
  try {
    const db = getOptimizedDb()
    
    // Find QR code in database
    const qr = await db.query.qrCodes.findFirst({
      where: eq(qrCodes.shortCode, qrCode),
      with: {
        workspace: true
      }
    })

    if (!qr) {
      return {
        success: false,
        valid: false,
        error: 'QR code not found'
      }
    }

    // Increment scan count
    await db
      .update(qrCodes)
      .set({
        scanCount: (qr.scanCount || 0) + 1,
        lastScannedAt: new Date()
      })
      .where(eq(qrCodes.id, qr.id))

    return {
      success: true,
      valid: true,
      qr: {
        id: qr.id,
        shortCode: qr.shortCode,
        type: qr.qrType,
        workspace: {
          id: qr.workspace.id,
          orderId: qr.workspace.orderId.toString(),
          orderNumber: qr.workspace.orderNumber,
          status: qr.workspace.status
        }
      }
    }
  } catch (error) {
    console.error('Error validating QR code:', error)
    return {
      success: false,
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to validate QR code'
    }
  }
}

export async function scanQR(qrCode: string, scannedBy?: string, location?: string) {
  try {
    const db = getOptimizedDb()
    
    // Find and validate QR code
    const qr = await db.query.qrCodes.findFirst({
      where: eq(qrCodes.shortCode, qrCode),
      with: {
        workspace: true
      }
    })

    if (!qr) {
      return {
        success: false,
        error: 'Invalid QR code'
      }
    }

    // Update scan count and log scan event
    await db
      .update(qrCodes)
      .set({
        scanCount: (qr.scanCount || 0) + 1,
        lastScannedAt: new Date(),
        scanHistory: [
          ...(qr.scanHistory as any[] || []),
          {
            scannedAt: new Date().toISOString(),
            scannedBy: scannedBy || 'unknown',
            location: location || 'unknown'
          }
        ]
      })
      .where(eq(qrCodes.id, qr.id))

    // Revalidate workspace page
    revalidatePath(`/workspace/${qr.workspace.orderId}`)

    return {
      success: true,
      workspace: {
        id: qr.workspace.id,
        orderId: qr.workspace.orderId.toString(),
        orderNumber: qr.workspace.orderNumber,
        status: qr.workspace.status,
        workflowPhase: qr.workspace.workflowPhase
      }
    }
  } catch (error) {
    console.error('Error scanning QR code:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scan QR code'
    }
  }
}

export async function getQRCodesForWorkspace(orderId: string) {
  try {
    const db = getOptimizedDb()
    
    // Find workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, BigInt(orderId)),
      with: {
        qrCodes: true
      }
    })

    if (!workspace) {
      return {
        success: false,
        error: 'Workspace not found'
      }
    }

    return {
      success: true,
      qrCodes: workspace.qrCodes
    }
  } catch (error) {
    console.error('Error fetching QR codes:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch QR codes'
    }
  }
}