import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '@/lib/services/workspace/service';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

const workspaceService = new WorkspaceService();

export async function GET(request: NextRequest) {
  try {
    const freightTagId = parseInt(process.env.FREIGHT_ORDER_TAG || '19844');
    
    // Fetch orders with freight tag from ShipStation
    // Trim any whitespace from environment variables
    const apiKey = process.env.SHIPSTATION_API_KEY?.trim() || '';
    const apiSecret = process.env.SHIPSTATION_API_SECRET?.trim() || '';
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    
    // Use the listbytag endpoint to get orders with the freight tag
    const response = await fetch(
      `https://ssapi.shipstation.com/orders/listbytag?` + 
      `orderStatus=awaiting_shipment&` +
      `tagId=${freightTagId}&` +
      `pageSize=500`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`ShipStation API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const freightOrders = data.orders || [];
    
    console.log(`Found ${freightOrders.length} orders with freight tag ${freightTagId}`);
    
    const created = [];
    const existing = [];
    
    // Process each freight order
    for (const order of freightOrders) {
      // Check if workspace already exists
      const existingWorkspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.orderId, order.orderId),
      });
      
      if (existingWorkspace) {
        existing.push({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          workspaceId: existingWorkspace.id,
          customerName: order.shipTo?.name || 'Unknown Customer',
          orderDate: order.orderDate,
          orderTotal: order.orderTotal,
          items: order.items?.filter((item: any) => 
            !item.name?.toLowerCase().includes('discount') && 
            item.unitPrice >= 0 && 
            !item.lineItemKey?.includes('discount')
          ).map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            sku: item.sku,
            unitPrice: item.unitPrice,
            customAttributes: item.options || [],
          })) || [],
        });
        continue;
      }
      
      // Create new workspace
      console.log(`Creating workspace for order ${order.orderNumber}`);
      
      const workspace = await workspaceService.createWorkspace(
        order.orderId,
        order.orderNumber,
        'freight-poll'
      );
      
      created.push({
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        workspaceId: workspace.id,
        workspaceUrl: `/workspace/${order.orderId}`,
        customerName: order.shipTo?.name || 'Unknown Customer',
        orderDate: order.orderDate,
        orderTotal: order.orderTotal,
        items: order.items?.filter((item: any) => 
          !item.name?.toLowerCase().includes('discount') && 
          item.unitPrice >= 0 && 
          !item.lineItemKey?.includes('discount')
        ).map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          sku: item.sku,
          unitPrice: item.unitPrice,
          customAttributes: item.options || [],
        })) || [],
      });
    }
    
    return NextResponse.json({
      success: true,
      totalFreightOrders: freightOrders.length,
      newWorkspaces: created.length,
      existingWorkspaces: existing.length,
      created,
      existing,
    });
  } catch (error) {
    console.error('Error polling freight orders:', error);
    return NextResponse.json({ error: 'Failed to poll freight orders' }, { status: 500 });
  }
}

// Manual trigger to create workspace for specific order
export async function POST(request: NextRequest) {
  try {
    const { orderId, orderNumber } = await request.json();
    
    if (!orderId && !orderNumber) {
      return NextResponse.json(
        { error: 'Order ID or order number required' },
        { status: 400 }
      );
    }
    
    // Fetch order from ShipStation
    const apiKey = process.env.SHIPSTATION_API_KEY!;
    const apiSecret = process.env.SHIPSTATION_API_SECRET!;
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    
    let url = 'https://ssapi.shipstation.com/orders';
    if (orderId) {
      url += `/${orderId}`;
    } else {
      url += `?orderNumber=${encodeURIComponent(orderNumber)}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`ShipStation API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const order = data.orders ? data.orders[0] : data;
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    // Check if it has freight tag
    const freightTagId = parseInt(process.env.FREIGHT_ORDER_TAG || '19844');
    const hasFreightTag = order.tagIds?.includes(freightTagId);
    
    if (!hasFreightTag) {
      return NextResponse.json(
        { error: 'Order does not have freight tag' },
        { status: 400 }
      );
    }
    
    // Create workspace
    const workspace = await workspaceService.createWorkspace(
      order.orderId,
      order.orderNumber,
      'manual-trigger'
    );
    
    return NextResponse.json({
      success: true,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      workspaceId: workspace.id,
      workspaceUrl: `/workspace/${order.orderId}`,
    });
  } catch (error) {
    console.error('Error creating workspace:', error);
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
  }
}