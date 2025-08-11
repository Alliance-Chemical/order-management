import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_DIR = path.join(process.cwd(), 'data', 'workspaces');

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
    const data = await request.json();
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
        items: data.items?.map((item: any) => ({
          orderItemId: item.order_item_id,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          weight: item.weight
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
        orderTotal: data.items?.reduce((sum: number, item: any) => 
          sum + (item.quantity * item.unit_price), 0) || 0
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
            itemCount: data.items?.length || 0
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

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'ShipStation webhook endpoint',
    timestamp: new Date().toISOString()
  });
}