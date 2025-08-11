import { NextRequest, NextResponse } from 'next/server';
import { QRGenerator } from '@/lib/services/qr/generator';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';

const qrGenerator = new QRGenerator();
const repository = new WorkspaceRepository();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qrCode, encodedData, userId = 'system' } = body;

    let qrData;
    
    if (encodedData) {
      // Decode from URL parameter
      qrData = qrGenerator.decodeQRUrl(encodedData);
    } else if (qrCode) {
      // Update scan count
      await repository.updateQRScanCount(qrCode, userId);
      
      // Extract encoded data from QR code URL
      const url = new URL(qrCode);
      const encoded = url.searchParams.get('qr');
      if (encoded) {
        qrData = qrGenerator.decodeQRUrl(encoded);
      }
    }

    if (!qrData) {
      return NextResponse.json({ error: 'Invalid QR code' }, { status: 400 });
    }

    // Find workspace
    const workspace = await repository.findByOrderId(qrData.orderId);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Log scan activity
    await repository.logActivity({
      workspaceId: workspace.id,
      activityType: 'qr_scanned',
      performedBy: userId,
      metadata: {
        qrType: qrData.type,
        containerNumber: qrData.containerNumber,
      },
    });

    return NextResponse.json({
      workspace,
      qrData,
    });
  } catch (error) {
    console.error('Error processing QR scan:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}