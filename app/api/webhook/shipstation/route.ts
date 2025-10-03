import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '@/lib/services/workspace/service';
import { tagSyncService } from '@/lib/services/shipstation/tag-sync';

const workspaceService = new WorkspaceService();

interface ShipStationOrderItem {
  name?: string;
  quantity?: number;
  sku?: string;
  unitPrice?: number;
  lineItemKey?: string;
  orderItemId?: number;
  options?: unknown[];
}

interface ShipStationOrder {
  orderId: number;
  orderNumber?: string;
  tagIds?: number[];
  items?: ShipStationOrderItem[];
}

// ShipStation webhook handler
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
    
    const body = await request.json();
    
    // ShipStation sends different webhook events
    const { resource_type, resource_url, action } = body;
    
    console.log('ShipStation webhook received:', { resource_type, action });

    // We're interested in order updates
    if (resource_type === 'ORDER_NOTIFY' && action === 'ORDER_UPDATED') {
      // Fetch the actual order data from ShipStation
      const orderId = extractOrderIdFromUrl(resource_url);
      if (!orderId) {
        console.warn('Unable to determine order ID from webhook URL:', resource_url);
        return NextResponse.json({ success: false, message: 'Order ID not found' }, { status: 400 });
      }

      const orderData = await fetchShipStationOrder(orderId);
      if (!orderData) {
        return NextResponse.json({ success: false, message: 'Order data unavailable' }, { status: 502 });
      }
      
      // Check if order has the freight tag (19844 from your .env)
      const freightTagId = parseInt(process.env.FREIGHT_ORDER_TAG || '19844');
      const hasFreightTag = orderData.tagIds?.includes(freightTagId);
      
      if (hasFreightTag) {
        console.log(`Freight order detected: ${orderData.orderNumber}`);
        
        // Check if workspace exists
        let workspace = await workspaceService.repository.findByOrderId(orderData.orderId);
        
        if (!workspace) {
          // Create workspace for this freight order
          await workspaceService.createWorkspace(
            orderData.orderId,
            orderData.orderNumber || String(orderData.orderId),
            'shipstation-webhook',
            'pump_and_fill' // Freight orders are pump_and_fill
          );

          // Refetch with relations
          workspace = await workspaceService.repository.findByOrderId(orderData.orderId);
          if (!workspace) {
            throw new Error('Failed to create workspace');
          }

          // Queue QR generation based on order items
          await queueQRGeneration(workspace.id, orderData);
        }
        
        // Sync tags to update workflow phase
        if (orderData.tagIds) {
          await tagSyncService.handleTagUpdate({
            order_id: orderData.orderId,
            tag_ids: orderData.tagIds
          });
        }
        
        // Log notification (removed AWS SNS dependency)
        await workspaceService.repository.logActivity({
          workspaceId: workspace.id,
          activityType: 'freight_order_received',
          performedBy: 'shipstation-webhook',
          metadata: {
            orderId: orderData.orderId,
            orderNumber: orderData.orderNumber,
            items: (orderData.items ?? []).map((item) => {
              const name = item.name ?? 'Unknown Item';
              const unitPrice = item.unitPrice ?? 0;
              const lineItemKey = item.lineItemKey ?? '';
              return {
                name,
                quantity: item.quantity ?? 0,
                sku: item.sku ?? 'N/A',
                unitPrice,
                isDiscount:
                  name.toLowerCase().includes('discount') ||
                  unitPrice < 0 ||
                  lineItemKey.includes('discount'),
                customAttributes: item.options ?? [],
              };
            }),
          }
        });
        
        return NextResponse.json({ 
          success: true, 
          message: 'Workspace created/updated',
          workspaceId: workspace.id 
        });
      }
    }
    
    // Handle tag update events
    if (resource_type === 'TAG_UPDATE' || action === 'TAG_ADDED' || action === 'TAG_REMOVED') {
      const orderId = extractOrderIdFromUrl(resource_url);
      if (!orderId) {
        console.warn('Unable to determine order ID for tag update:', resource_url);
        return NextResponse.json({ success: false, message: 'Order ID not found' }, { status: 400 });
      }

      const orderData = await fetchShipStationOrder(orderId);
      if (!orderData) {
        return NextResponse.json({ success: false, message: 'Order data unavailable' }, { status: 502 });
      }
      
      // Sync tags to workflow
      if (orderData.tagIds) {
        await tagSyncService.handleTagUpdate({
          order_id: orderData.orderId,
          tag_ids: orderData.tagIds
        });
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Tags synced'
      });
    }
    
    return NextResponse.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('ShipStation webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

function extractOrderIdFromUrl(url: string): number {
  // Extract order ID from ShipStation resource URL
  const match = url.match(/orders\/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

async function fetchShipStationOrder(orderId: number): Promise<ShipStationOrder | null> {
  // Trim any whitespace from environment variables
  const apiKey = process.env.SHIPSTATION_API_KEY?.trim() || '';
  const apiSecret = process.env.SHIPSTATION_API_SECRET?.trim() || '';
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  
  const response = await fetch(`https://ssapi.shipstation.com/orders/${orderId}`, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch order: ${response.statusText}`);
  }
  
  const raw = (await response.json()) as Record<string, unknown>;
  const items = Array.isArray(raw.items)
    ? raw.items.map((item) => {
        if (!item || typeof item !== 'object') {
          return {} as ShipStationOrderItem;
        }
        const entry = item as Record<string, unknown>;
        return {
          name: typeof entry.name === 'string' ? entry.name : undefined,
          quantity: typeof entry.quantity === 'number' ? entry.quantity : undefined,
          sku: typeof entry.sku === 'string' ? entry.sku : undefined,
          unitPrice: typeof entry.unitPrice === 'number'
            ? entry.unitPrice
            : typeof entry.unit_price === 'number'
              ? entry.unit_price
              : undefined,
          lineItemKey: typeof entry.lineItemKey === 'string'
            ? entry.lineItemKey
            : typeof entry.line_item_key === 'string'
              ? entry.line_item_key
              : undefined,
          orderItemId: typeof entry.orderItemId === 'number'
            ? entry.orderItemId
            : typeof entry.order_item_id === 'number'
              ? entry.order_item_id
              : undefined,
          options: Array.isArray(entry.options) ? entry.options : undefined,
        } satisfies ShipStationOrderItem;
      })
    : [];

  const orderIdValue = raw.orderId ?? raw.order_id;
  const normalizedOrderId = typeof orderIdValue === 'number'
    ? orderIdValue
    : typeof orderIdValue === 'string'
      ? Number.parseInt(orderIdValue, 10)
      : orderId;

  if (!Number.isFinite(normalizedOrderId)) {
    return null;
  }

  const tagIds = Array.isArray(raw.tagIds)
    ? (raw.tagIds as unknown[]).filter((id): id is number => typeof id === 'number')
    : undefined;

  return {
    orderId: normalizedOrderId,
    orderNumber: typeof raw.orderNumber === 'string' ? raw.orderNumber : undefined,
    tagIds,
    items,
  };
}

async function queueQRGeneration(workspaceId: string, orderData: ShipStationOrder) {
  const items = orderData.items ?? [];
  
  // Filter out discount line items (they have no SKU and typically quantity of 1)
  const physicalItems = items.filter((item) => {
    // Discount items typically have no SKU and name contains 'discount' or starts with negative price
    const hasNoSku = !item.sku || item.sku === '';
    const name = item.name?.toLowerCase() ?? '';
    const unitPrice = item.unitPrice ?? 0;
    const lineKey = item.lineItemKey ?? '';
    const isDiscount = name.includes('discount') || unitPrice < 0 || lineKey.includes('discount');
    
    // Exclude if it's a discount item
    if (hasNoSku && isDiscount) {
      console.log(`Filtering out discount item: ${item.name}`);
      return false;
    }
    return true;
  });
  
  // Analyze items to determine QR generation strategy
  let qrStrategy = 'single_master'; // default
  let containerCount = 0;
  
  // Count drums and totes
  physicalItems.forEach((item) => {
    const name = item.name?.toLowerCase() || '';
    const qty = item.quantity ?? 1;
    
    if (name.includes('drum') || name.includes('tote')) {
      containerCount += qty;
    }
  });
  
  // If 5 or fewer drums/totes, generate individual QRs
  if (containerCount > 0 && containerCount <= 5) {
    qrStrategy = 'per_container';
  }
  
  // Queue QR generation using improved KV queue with deduplication
  const { kvQueue } = await import('@/lib/queue/kv-queue');
  await kvQueue.enqueue(
    'jobs',
    'qr_generation',
    {
      action: 'generate_qr_codes',
      workspaceId,
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber,
      strategy: qrStrategy,
      items: physicalItems.map((item) => ({
        name: item.name ?? 'Unknown Item',
        sku: item.sku ?? 'N/A',
        quantity: item.quantity ?? 0,
        itemId: item.orderItemId,
      })),
      containerCount,
    },
    {
      fingerprint: `qr_webhook_${orderData.orderId}`, // Prevent duplicate QR generation from webhook bursts
      maxRetries: 3,
    }
  );
}
