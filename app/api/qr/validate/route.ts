import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';

const repo = new WorkspaceRepository();

export async function POST(request: NextRequest) {
  try {
    const { shortCode, orderId } = await request.json();

    if (!shortCode || typeof shortCode !== 'string' || !/^[A-Z0-9]{6,8}$/i.test(shortCode)) {
      return NextResponse.json({ code: 'INVALID_FORMAT', message: 'Invalid short code format' }, { status: 400 });
    }

    const qr = await repo.findQRByShortCode(shortCode.toUpperCase(), orderId);
    if (!qr) {
      return NextResponse.json({ code: 'NOT_FOUND', message: 'QR code not found' }, { status: 404 });
    }

    // Normalize response for the validator
    return NextResponse.json({
      id: qr.id,
      workspaceId: qr.workspaceId,
      qrType: qr.qrType,
      qrCode: qr.qrCode,
      shortCode: qr.shortCode,
      orderId: qr.orderId,
      orderNumber: qr.orderNumber,
      containerNumber: qr.containerNumber,
      encodedData: qr.encodedData,
      qrUrl: qr.qrUrl,
      isActive: qr.isActive,
      scannedAt: qr.lastScannedAt,
    });
  } catch (error) {
    console.error('QR validate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

