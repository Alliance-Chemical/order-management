import { NextRequest, NextResponse } from 'next/server';
import { KVCache } from '@/lib/cache/kv-cache';

interface DecodedQRData {
  orderId: number | string;
  type?: string;
  containerNumber?: number | string;
  [key: string]: unknown;
}

interface WorkspaceSummary {
  id: string;
  [key: string]: unknown;
}

// Enable Edge Runtime for maximum performance
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Lightweight QR decoder for Edge Runtime
function decodeQRUrl(encoded: string): DecodedQRData | null {
  try {
    const decoded = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(decoded) as unknown;
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      const orderId = record.orderId;
      if (typeof orderId === 'string' || typeof orderId === 'number') {
        return {
          ...record,
          orderId,
        } as DecodedQRData;
      }
    }
  } catch (_error) {
    // Intentionally swallow error and fall through to null return
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qrCode, encodedData, userId = 'system' } = body;

    let qrData: DecodedQRData | null = null;
    let cacheKey: string | null = null;
    
    // Try to decode QR data
    if (encodedData) {
      qrData = decodeQRUrl(encodedData);
      cacheKey = `qr:${encodedData}`;
    } else if (qrCode) {
      // Extract encoded data from QR code URL
      const url = new URL(qrCode);
      const encoded = url.searchParams.get('qr');
      if (encoded) {
        qrData = decodeQRUrl(encoded);
        cacheKey = `qr:${encoded}`;
      }
    }

    if (!qrData) {
      return NextResponse.json(
        { error: 'Invalid QR code', valid: false },
        { status: 400 }
      );
    }

    // Check cache first for workspace data
    const workspaceCacheKey = `workspace:order:${qrData.orderId}`;
    let workspace = await KVCache.get<WorkspaceSummary>(workspaceCacheKey);
    
    if (!workspace) {
      // If not in cache, fetch from main API
      // This will be replaced with direct database access in production
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/workspaces/by-order/${qrData.orderId}`,
        {
          headers: {
            'x-internal-request': 'true',
          },
        }
      );
      
      if (!response.ok) {
        return NextResponse.json(
          { error: 'Workspace not found', valid: false },
          { status: 404 }
        );
      }
      
      const json = (await response.json()) as unknown;
      if (!json || typeof json !== 'object' || typeof (json as { id?: unknown }).id !== 'string') {
        return NextResponse.json(
          { error: 'Workspace payload invalid', valid: false },
          { status: 502 }
        );
      }

      workspace = json as WorkspaceSummary;

      // Cache the workspace data
      await KVCache.set(workspaceCacheKey, workspace, 300); // 5 minute cache
    }

    // Cache the QR validation result
    if (cacheKey) {
      await KVCache.set(cacheKey, {
        valid: true,
        workspace: workspace,
        qrData: qrData,
        lastScanned: new Date().toISOString(),
        scannedBy: userId,
      }, 3600); // 1 hour cache for QR codes
    }

    // Log scan asynchronously (don't wait)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/activity/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: workspace.id,
        activityType: 'qr_scanned',
        performedBy: userId,
        metadata: {
          qrType: qrData.type,
          containerNumber: qrData.containerNumber,
        },
      }),
    }).catch(console.error);

    return NextResponse.json({
      valid: true,
      workspace,
      qrData,
      cached: false,
    });
  } catch (error) {
    console.error('Edge QR scan error:', error);
    return NextResponse.json(
      { error: 'Internal server error', valid: false },
      { status: 500 }
    );
  }
}

// Preflight for CORS
export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
