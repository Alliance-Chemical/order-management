import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '@/lib/services/workspace/service';
import { tagSyncService } from '@/lib/services/shipstation/tag-sync';
import { qrGenerationQueue, webhookQueue } from '@/lib/services/kv-queue';

const workspaceService = new WorkspaceService();

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
      const orderData = await fetchShipStationOrder(orderId);
      
      // Check if order has the freight tag (19844 from your .env)
      const freightTagId = parseInt(process.env.FREIGHT_ORDER_TAG || '19844');
      const hasFreightTag = orderData.tagIds?.includes(freightTagId);
      
      if (hasFreightTag) {
        console.log(`Freight order detected: ${orderData.orderNumber}`);
        
        // Check if workspace exists
        let workspace = await workspaceService.repository.findByOrderId(orderData.orderId);
        
        if (!workspace) {
          // Create workspace for this freight order
          workspace = await workspaceService.createWorkspace(
            orderData.orderId,
            orderData.orderNumber,
            'shipstation-webhook',
            'pump_and_fill' // Freight orders are pump_and_fill
          );
          
          // Queue QR generation based on order items
          await queueQRGeneration(workspace.id, orderData);
        }
        
        // Sync tags to update workflow phase
        await tagSyncService.handleTagUpdate({
          order_id: orderData.orderId,
          tag_ids: orderData.tagIds || []
        });
        
        // Log notification (removed AWS SNS dependency)
        await workspaceService.repository.logActivity({
          workspaceId: workspace.id,
          activityType: 'freight_order_received',
          performedBy: 'shipstation-webhook',
          metadata: {
            orderId: orderData.orderId,
            orderNumber: orderData.orderNumber,
            items: orderData.items?.map((item: any) => ({
              name: item.name,
              quantity: item.quantity,
              sku: item.sku,
              unitPrice: item.unitPrice,
              isDiscount: item.name?.toLowerCase().includes('discount') || 
                         item.unitPrice < 0 || 
                         item.lineItemKey?.includes('discount'),
              customAttributes: item.options || [],
            })) || [],
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
      const orderData = await fetchShipStationOrder(orderId);
      
      // Sync tags to workflow
      await tagSyncService.handleTagUpdate({
        order_id: orderData.orderId,
        tag_ids: orderData.tagIds || []
      });
      
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

async function fetchShipStationOrder(orderId: number) {
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
  
  return response.json();
}

async function queueQRGeneration(workspaceId: string, orderData: any) {
  const items = orderData.items || [];
  
  // Filter out discount line items (they have no SKU and typically quantity of 1)
  const physicalItems = items.filter((item: any) => {
    // Discount items typically have no SKU and name contains 'discount' or starts with negative price
    const hasNoSku = !item.sku || item.sku === '';
    const isDiscount = item.name?.toLowerCase().includes('discount') || 
                       item.unitPrice < 0 || 
                       item.lineItemKey?.includes('discount');
    
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
  physicalItems.forEach((item: any) => {
    const name = item.name?.toLowerCase() || '';
    const qty = item.quantity || 1;
    
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
      items: physicalItems.map((item: any) => ({
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
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