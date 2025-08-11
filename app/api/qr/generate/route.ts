import { NextRequest, NextResponse } from 'next/server';
import { QRGenerator } from '@/lib/services/qr/generator';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';

const qrGenerator = new QRGenerator();
const repository = new WorkspaceRepository();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, orderNumber, type = 'master', containerNumber, chemicalName } = body;

    if (!orderId || !orderNumber) {
      return NextResponse.json(
        { error: 'Order ID and order number are required' },
        { status: 400 }
      );
    }

    // Generate QR data
    const qrData = qrGenerator.createQRData(orderId, orderNumber, type, containerNumber, chemicalName);
    const qrCode = await qrGenerator.generateQRCode(qrData);
    const shortCode = qrGenerator.generateShortCode(orderId, containerNumber);
    const qrUrl = qrGenerator.createQRUrl(qrData);

    // Find workspace
    const workspace = await repository.findByOrderId(orderId);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
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
    });

    return NextResponse.json({
      id: savedQR.id,
      qrCode,
      shortCode,
      url: qrUrl,
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}