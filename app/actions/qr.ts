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
    const qrUrl = qrGenerator.createShortCodeUrl(shortCode)

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
        const qrUrl = qrGenerator.createShortCodeUrl(shortCode)

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

// Add additional QR codes without deleting existing records.
// Each item should include: { name, sku?, labelCount }
export async function addQRCodes(orderId: string, items: Array<{ name: string; sku?: string; labelCount: number }>) {
  try {
    const db = getOptimizedDb()

    // Find workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, BigInt(orderId))
    })

    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    // Determine next container number
    const existing = await db.query.qrCodes.findMany({
      where: eq(qrCodes.workspaceId, workspace.id)
    })
    let nextContainer = Math.max(0, ...existing.map((qr: any) => qr.containerNumber || 0)) + 1

    const created: any[] = []

    for (const item of items) {
      const count = Math.max(0, Number(item.labelCount) || 0)
      for (let i = 0; i < count; i++) {
        const containerNumber = nextContainer++
        const qrData = qrGenerator.createQRData(
          Number(orderId),
          workspace.orderNumber,
          // Using 'container' to match downstream expectations
          // even though low-level type union may not include it
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          'container',
          containerNumber,
          item.name
        )
        const shortCode = qrGenerator.generateShortCode(Number(orderId), containerNumber)
        const qrUrl = qrGenerator.createShortCodeUrl(shortCode)

        const saved = await db
          .insert(qrCodes)
          .values({
            workspaceId: workspace.id,
            qrType: 'container',
            qrCode: shortCode,
            shortCode,
            orderId: BigInt(orderId),
            orderNumber: workspace.orderNumber,
            containerNumber,
            chemicalName: item.name,
            encodedData: qrData,
            qrUrl,
          })
          .returning()

        created.push(saved[0])
      }
    }

    // Revalidate workspace page
    revalidatePath(`/workspace/${orderId}`)

    return { success: true, qrCodes: created }
  } catch (error) {
    console.error('Error adding QR codes:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add QR codes'
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

function extractShortCodeOrLookupParams(raw: string): { shortCode?: string; orderId?: number; containerNumber?: number } {
  const input = (raw || '').trim();
  // Plain short code (alnum, 5-12)
  if (/^[A-Za-z0-9]{5,12}$/.test(input)) {
    return { shortCode: input };
  }
  // Try URL parse
  try {
    const url = new URL(input);
    // /qr/s/{shortCode}
    const m = url.pathname.match(/\/qr\/s\/([A-Za-z0-9-_.]+)/);
    if (m && m[1]) {
      return { shortCode: m[1] };
    }
    // ?sc=SHORTCODE
    const sc = url.searchParams.get('sc');
    if (sc) {
      return { shortCode: sc };
    }
    // Legacy: ?qr=base64url(JSON)
    const encoded = url.searchParams.get('qr');
    if (encoded) {
      try {
        const fixed = encoded.replace(/-/g, '+').replace(/_/g, '/');
        const pad = fixed.length % 4 === 0 ? '' : '='.repeat(4 - (fixed.length % 4));
        const json = JSON.parse(Buffer.from(fixed + pad, 'base64').toString());
        const orderId = Number(json.orderId);
        const containerNumber = json.containerNumber != null ? Number(json.containerNumber) : undefined;
        if (!Number.isNaN(orderId)) {
          return { orderId, containerNumber };
        }
      } catch {}
    }
  } catch {}
  return {};
}

export async function validateQR(qrCode: string) {
  try {
    const db = getOptimizedDb()
    const { shortCode, orderId, containerNumber } = extractShortCodeOrLookupParams(qrCode);

    let qr: any | null = null;
    if (shortCode) {
      qr = await db.query.qrCodes.findFirst({
        where: eq(qrCodes.shortCode, shortCode),
        with: { workspace: true }
      });
    } else if (orderId) {
      // Try to find by orderId + containerNumber (legacy payload path)
      const clauses: any[] = [eq(qrCodes.orderId, BigInt(orderId))];
      if (typeof containerNumber === 'number') {
        clauses.push(eq(qrCodes.containerNumber, containerNumber));
      }
      qr = await db.query.qrCodes.findFirst({
        where: and(...clauses),
        with: { workspace: true }
      });
    }

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
    const { shortCode, orderId, containerNumber } = extractShortCodeOrLookupParams(qrCode);
    
    // Find and validate QR code
    let qr: any | null = null;
    if (shortCode) {
      qr = await db.query.qrCodes.findFirst({
        where: eq(qrCodes.shortCode, shortCode),
        with: { workspace: true }
      });
    } else if (orderId) {
      const clauses: any[] = [eq(qrCodes.orderId, BigInt(orderId))];
      if (typeof containerNumber === 'number') {
        clauses.push(eq(qrCodes.containerNumber, containerNumber));
      }
      qr = await db.query.qrCodes.findFirst({
        where: and(...clauses),
        with: { workspace: true }
      });
    }

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

    // If no QR codes exist, trigger generation
    if (!workspace.qrCodes || workspace.qrCodes.length === 0) {
      console.log(`[QR] No QR codes found for order ${orderId}, triggering generation...`);

      try {
        // Call the QR generation endpoint to create codes
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
        const response = await fetch(`${baseUrl}/api/workspace/${orderId}/qrcodes`, {
          method: 'GET',
          headers: {
            'User-Agent': 'QRFetch/1.0'
          }
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`[QR] Generated ${result.qrCodes?.length || 0} QR codes for order ${orderId}`);

          return {
            success: true,
            qrCodes: result.qrCodes || []
          };
        } else {
          console.warn(`[QR] Failed to generate QR codes: ${response.status}`);
        }
      } catch (error) {
        console.error('[QR] Error generating QR codes:', error);
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
