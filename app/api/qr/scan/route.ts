import { NextRequest, NextResponse } from 'next/server';
import { QRGenerator } from '@/src/services/qr/qrGenerator';
import { getEdgeDb, withEdgeRetry } from '@/lib/db/neon-edge';
import { kv } from '@/lib/kv';
import { workspaces, activityLog } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const qrGenerator = new QRGenerator();

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

    // Find workspace (KV cache for 60s)
    const db = getEdgeDb();
    const cacheKey = `ws:byOrderId:${qrData.orderId}`;
    let workspace = await kv.get(cacheKey);
    if (!workspace) {
      const rows = await withEdgeRetry(() => db
        .select()
        .from(workspaces)
        .where(eq(workspaces.orderId, Number(qrData.orderId)))
        .limit(1)
      );
      workspace = rows?.[0] || null;
      if (workspace) {
        await kv.set(cacheKey, workspace, { ex: 60 });
      }
    }
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Log scan activity
    await withEdgeRetry(() => db.insert(activityLog).values({
      workspaceId: workspace.id,
      activityType: 'qr_scanned',
      performedBy: userId,
      performedAt: new Date(),
      metadata: {
        qrType: (qrData as any).type,
        containerNumber: (qrData as any).containerNumber,
      } as any,
    }));

    return NextResponse.json({
      workspace,
      qrData,
    });
  } catch (error) {
    console.error('Error processing QR scan:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
