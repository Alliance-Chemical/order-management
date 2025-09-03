import { NextRequest, NextResponse } from 'next/server';
import { getEdgeDb, withEdgeRetry } from '@/lib/db/neon-edge';
import { qrCodes } from '@/lib/db/schema/qr-workspace';
import { eq, and } from 'drizzle-orm';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shortCode, orderId } = body;
    
    const db = getEdgeDb();

    if (!shortCode) {
      return NextResponse.json(
        { code: 'INVALID_FORMAT', message: 'Short code is required' },
        { status: 400 }
      );
    }

    // Normalize short code
    const normalizedCode = shortCode.trim().toUpperCase();

    // Query for QR code with this short code
    const conditions = [eq(qrCodes.shortCode, normalizedCode)];
    
    // If orderId provided, ensure it matches
    if (orderId) {
      conditions.push(eq(qrCodes.orderId, Number(orderId)));
    }

    const qrRecord = await withEdgeRetry(() => db
      .select()
      .from(qrCodes)
      .where(and(...conditions))
      .limit(1)
    );

    if (!qrRecord || qrRecord.length === 0) {
      return NextResponse.json(
        { 
          code: 'NOT_FOUND',
          message: orderId 
            ? `Code ${normalizedCode} not found for this order` 
            : `Code ${normalizedCode} not found`
        },
        { status: 404 }
      );
    }

    const record = qrRecord[0];

    // Environment mismatch check (staging vs prod)
    try {
      const requestHost = new URL(request.url).host;
      if (record.qrUrl) {
        const qrHost = new URL(record.qrUrl).host;
        const localHosts = ['localhost:3000', '127.0.0.1:3000'];
        if (qrHost && requestHost && qrHost !== requestHost && !localHosts.includes(qrHost) && !localHosts.includes(requestHost)) {
          return NextResponse.json(
            { code: 'WRONG_ENV', message: `This code was issued for ${qrHost}, but you are validating on ${requestHost}.` },
            { status: 409 }
          );
        }
      }
    } catch {}

    // Duplicate/consumed check
    if ((record.scanCount ?? 0) > 0) {
      return NextResponse.json(
        { code: 'ALREADY_CONSUMED', message: 'This code has already been used' },
        { status: 409 }
      );
    }

    // Update scan count
    await withEdgeRetry(() => db
      .update(qrCodes)
      .set({
        scanCount: (record.scanCount || 0) + 1,
        lastScannedAt: new Date(),
        lastScannedBy: 'manual_entry'
      })
      .where(eq(qrCodes.id, record.id))
    );

    return NextResponse.json(record);
  } catch (error) {
    console.error('Error validating short code:', error);
    return NextResponse.json(
      { code: 'SERVER_ERROR', message: 'Failed to validate code' },
      { status: 500 }
    );
  }
}
