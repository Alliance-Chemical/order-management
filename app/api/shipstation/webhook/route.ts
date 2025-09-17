import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_DIR = path.join(process.cwd(), 'data', 'workspaces');

interface ShipStationWebhookItem {
  order_item_id?: number;
  name?: string;
  sku?: string;
  quantity?: number;
  unit_price?: number;
  weight?: unknown;
}

interface ShipStationWebhookPayload {
  order_id: number | string;
  order_number?: string;
  order_status?: string;
  order_date?: string;
  ship_date?: string;
  tracking_number?: string;
  carrier?: string;
  service_code?: string;
  items?: ShipStationWebhookItem[];
  ship_to?: Record<string, unknown>;
  customer_email?: string;
  customer_notes?: string;
  internal_notes?: string;
  requested_shipping_service?: string;
  weight?: unknown;
  dimensions?: unknown;
  insurance_options?: unknown;
  advanced_options?: unknown;
}

// Ensure workspace directory exists
async function ensureWorkspaceDir() {
  try {
    await fs.access(WORKSPACE_DIR);
  } catch {
    await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook authenticity
    const webhookSecret = process.env.SHIPSTATION_WEBHOOK_SECRET;
    if (webhookSecret) {
      // ShipStation sends the secret in X-SS-Webhook-Secret header
      const ssWebhookSecret = request.headers.get('X-SS-Webhook-Secret');
      // Also check authorization header for backward compatibility
      const authHeader = request.headers.get('authorization');
      
      const isValidSecret = ssWebhookSecret === webhookSecret || 
                           authHeader === `Bearer ${webhookSecret}`;
      
      if (!isValidSecret) {
        console.warn('Invalid webhook authorization');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    const data = (await request.json()) as ShipStationWebhookPayload;

    if (data.order_id === undefined || data.order_id === null) {
      return NextResponse.json({ error: 'Missing order_id in payload' }, { status: 400 });
    }

    const items = data.items ?? [];
    console.log('ShipStation webhook received:', {
      orderId: data.order_id,
      orderNumber: data.order_number,
      status: data.order_status,
      event: request.headers.get('x-shipstation-event')
    });

    await ensureWorkspaceDir();

    // Create or update workspace data
    const workspace = {
      id: String(data.order_id),
      orderId: data.order_id,
      orderNumber: data.order_number,
      status: data.order_status === 'awaiting_shipment' ? 'active' : 
              data.order_status === 'shipped' ? 'shipped' : 'pending',
      workflowPhase: 'pre_mix',
      shipstationData: {
        orderDate: data.order_date,
        shipDate: data.ship_date,
        trackingNumber: data.tracking_number,
        carrier: data.carrier,
        serviceCode: data.service_code,
        items: items.map((item) => ({
          orderItemId: item.order_item_id ?? null,
          name: item.name ?? 'Unknown Item',
          sku: item.sku ?? 'N/A',
          quantity: item.quantity ?? 0,
          unitPrice: item.unit_price ?? 0,
          weight: item.weight ?? null
        })),
        shipTo: data.ship_to,
        customerEmail: data.customer_email,
        customerNotes: data.customer_notes,
        internalNotes: data.internal_notes,
        requestedShippingService: data.requested_shipping_service,
        weight: data.weight,
        dimensions: data.dimensions,
        insuranceOptions: data.insurance_options,
        advancedOptions: data.advanced_options,
        orderTotal: items.reduce((sum, item) => 
          sum + (item.quantity ?? 0) * (item.unit_price ?? 0), 0)
      },
      documents: [],
      activities: [
        {
          id: `activity_${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'webhook',
          description: 'Order synced from ShipStation',
          metadata: {
            status: data.order_status,
            itemCount: items.length
          }
        }
      ],
      moduleStates: {
        pre_mix: { status: 'pending', items: [] },
        pre_ship: { status: 'pending', items: [] }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save workspace to file
    const workspaceFile = path.join(WORKSPACE_DIR, `${data.order_id}.json`);
    await fs.writeFile(workspaceFile, JSON.stringify(workspace, null, 2));

    console.log('Workspace created/updated:', workspaceFile);

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      workspace: {
        id: workspace.id,
        orderId: workspace.orderId,
        orderNumber: workspace.orderNumber,
        status: workspace.status
      }
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'ShipStation webhook endpoint',
    timestamp: new Date().toISOString()
  });
}
