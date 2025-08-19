import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { qrCodes } from '@/lib/db/schema/qr-workspace';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shortCode, orderId } = body;

    if (!shortCode) {
      return NextResponse.json(
        { message: 'Short code is required' },
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

    const qrRecord = await db
      .select()
      .from(qrCodes)
      .where(and(...conditions))
      .limit(1);

    if (!qrRecord || qrRecord.length === 0) {
      return NextResponse.json(
        { 
          message: orderId 
            ? `Code ${normalizedCode} not found for this order` 
            : `Code ${normalizedCode} not found`
        },
        { status: 404 }
      );
    }

    // Update scan count
    await db
      .update(qrCodes)
      .set({
        scanCount: (qrRecord[0].scanCount || 0) + 1,
        lastScannedAt: new Date(),
        lastScannedBy: 'manual_entry'
      })
      .where(eq(qrCodes.id, qrRecord[0].id));

    return NextResponse.json(qrRecord[0]);
  } catch (error) {
    console.error('Error validating short code:', error);
    return NextResponse.json(
      { message: 'Failed to validate code' },
      { status: 500 }
    );
  }
}