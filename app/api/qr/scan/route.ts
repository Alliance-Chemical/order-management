import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';
import { db } from '@/lib/db';
import { activityLog, qrCodes } from '@/lib/db/schema/qr-workspace';
import { and, eq, sql } from 'drizzle-orm';

const repo = new WorkspaceRepository();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      // From direct scanner call
      qrCode,
      shortCode,
      orderId,
      scanType,
      stepId,
      timestamp,
      // From offline queue
      qrData,
    } = body || {};

    const userId = request.headers.get('x-user-id') || 'worker';

    // Resolve QR by either shortCode, full qrCode, or qrData.shortCode
    const effectiveShort = (shortCode || qrData?.shortCode || '').toString().toUpperCase();
    let qrRecord: any | null = null;

    if (effectiveShort) {
      qrRecord = await repo.findQRByShortCode(effectiveShort, orderId);
    } else if (qrCode && typeof qrCode === 'string') {
      // Look up by full qrCode value
      qrRecord = await db.query.qrCodes.findFirst({ where: eq(qrCodes.qrCode, qrCode) });
    }

    // If nothing resolvable, accept and log as generic event (still useful operationally)
    if (!qrRecord) {
      await db.insert(activityLog).values({
        workspaceId: undefined as any, // unknown
        activityType: 'qr_scan_unresolved',
        performedBy: userId,
        metadata: { qrCode, shortCode: effectiveShort || undefined, qrData, orderId, scanType, stepId, timestamp },
      });
      return NextResponse.json({ success: true, unresolved: true });
    }

    // Update scan count and last scanned
    await repo.updateQRScanCount(qrRecord.qrCode, userId);

    // Log activity against the workspace if known
    if (qrRecord.workspaceId) {
      await db.insert(activityLog).values({
        workspaceId: qrRecord.workspaceId,
        activityType: 'qr_scanned',
        performedBy: userId,
        metadata: {
          qrId: qrRecord.id,
          qrType: qrRecord.qrType,
          shortCode: qrRecord.shortCode,
          qrCode: qrRecord.qrCode,
          orderId: qrRecord.orderId,
          scanType: scanType || stepId,
          raw: qrData || qrCode || null,
          timestamp: timestamp || new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({ success: true, qrId: qrRecord.id });
  } catch (error) {
    console.error('QR scan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

