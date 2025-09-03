import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '@/lib/services/workspace/service';
import { getDb } from '@/src/data/db/client';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { freightOrders } from '@/lib/db/schema/freight';
import { eq, and, isNotNull } from 'drizzle-orm';

const db = getDb();

const workspaceService = new WorkspaceService();

export async function GET(request: NextRequest) {
  try {
    const freightTagId = parseInt(process.env.FREIGHT_ORDER_TAG || '19844');
    
    // Fetch orders with freight tag from ShipStation
    // Trim any whitespace from environment variables
    const apiKey = process.env.SHIPSTATION_API_KEY?.trim() || '';
    const apiSecret = process.env.SHIPSTATION_API_SECRET?.trim() || '';
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    
    // Fetch ALL orders with the freight tag - paginate through all pages
    let allFreightOrders = [];
    let page = 1;
    let hasMorePages = true;
    
    while (hasMorePages) {
      const response = await fetch(
        `https://ssapi.shipstation.com/orders/listbytag?` + 
        `orderStatus=awaiting_shipment&` +
        `tagId=${freightTagId}&` +
        `page=${page}&` +
        `pageSize=500`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ShipStation API error: ${response.status} - ${errorText}`);
        throw new Error(`ShipStation API error: ${response.statusText}`);
      }
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('ShipStation returned non-JSON response:', text);
        throw new Error('ShipStation API returned non-JSON response');
      }
      
      const data = await response.json();
      const orders = data.orders || [];
      allFreightOrders = [...allFreightOrders, ...orders];
      
      // Check if there are more pages
      hasMorePages = data.pages && page < data.pages;
      page++;
      
      // Add a small delay to avoid rate limiting
      if (hasMorePages) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    const freightOrders = allFreightOrders;
    
    
    const created = [];
    const existing = [];
    
    // Process each freight order
    for (const order of freightOrders) {
      // Check if workspace already exists
      const [existingWorkspace] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.orderId, order.orderId))
        .limit(1);
      
      if (existingWorkspace) {
        existing.push({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          workspaceId: existingWorkspace.id,
          customerName: order.shipTo?.name || 'Unknown Customer',
          orderDate: order.orderDate,
          orderTotal: order.orderTotal,
          items: order.items?.map((item: any) => ({
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
      
      try {
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
          items: order.items?.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            sku: item.sku,
            unitPrice: item.unitPrice,
            customAttributes: item.options || [],
          })) || [],
        });
      } catch (error: any) {
        // Handle duplicate key error - workspace may have been created by another process
        if (error?.message?.includes('duplicate key')) {
          console.log(`Workspace already exists for order ${order.orderNumber}, checking again`);
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
          }
        } else {
          // Re-throw other errors
          throw error;
        }
      }
    }
    
    // TODO: Add freight-booked orders integration (temporarily disabled for debugging)
    const totalOrders = freightOrders.length;
    
    return NextResponse.json({
      success: true,
      totalFreightOrders: totalOrders,
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