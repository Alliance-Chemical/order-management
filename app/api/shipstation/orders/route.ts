import { NextResponse } from 'next/server';

interface ShipStationOrderItem {
  name: string;
  quantity: number;
  sku?: string;
  unitPrice?: number;
  options?: Array<Record<string, unknown>>;
}

interface ShipStationAddress {
  name?: string;
  [key: string]: unknown;
}

interface ShipStationOrder {
  orderId: number;
  orderNumber: string;
  customerEmail?: string;
  orderDate: string;
  orderTotal: number;
  orderStatus: string;
  tagIds?: number[];
  shipTo?: ShipStationAddress;
  billTo?: ShipStationAddress;
  items?: ShipStationOrderItem[];
}

interface ShipStationOrderResponse {
  orders: ShipStationOrder[];
  pages?: number;
}

interface FormattedOrder {
  orderId: number;
  orderNumber: string;
  customerName: string;
  orderDate: string;
  orderTotal: number;
  orderStatus: string;
  tagIds: number[];
  shipTo: ShipStationAddress;
  billTo: ShipStationAddress;
  items: Array<{
    name: string;
    quantity: number;
    sku?: string;
    unitPrice?: number;
    customAttributes: Array<Record<string, unknown>>;
  }>;
}

export async function GET() {
  try {
    // Get freight order tag ID from environment - show all freight orders
    const freightTagId = parseInt(process.env.FREIGHT_ORDER_TAG || '19844');
    
    // Trim any whitespace from environment variables
    const apiKey = process.env.SHIPSTATION_API_KEY?.trim() || '';
    const apiSecret = process.env.SHIPSTATION_API_SECRET?.trim() || '';
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    
    // Fetch ALL freight-tagged orders using listbytag endpoint
    const allFreightOrders: ShipStationOrder[] = [];
    let page = 1;
    let hasMorePages = true;
    
    while (hasMorePages) {
      // Retry logic for network issues
      let response: Response | undefined;
      let retries = 3;
      while (retries > 0) {
        try {
          response = await fetch(
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
              signal: AbortSignal.timeout(30000), // 30 second timeout
            }
          );
          break; // Success, exit retry loop
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
          console.log(`ShipStation request failed, retrying... (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
        }
      }
      
      if (!response || !response.ok) {
        throw new Error(`ShipStation API error: ${response?.statusText || 'Unknown error'}`);
      }
      
      const data = await response.json() as ShipStationOrderResponse;
      const orders = data.orders || [];
      allFreightOrders.push(...orders);
      
      // Check if there are more pages
      const totalPages = typeof data.pages === 'number' ? data.pages : 0;
      hasMorePages = totalPages > 0 && page < totalPages;
      page++;
      
      // Add a small delay to avoid rate limiting
      if (hasMorePages) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Format orders for display - filter out discount items
    const formattedOrders: FormattedOrder[] = allFreightOrders.map(order => ({
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      customerName: order.shipTo?.name || 'Unknown Customer',
      orderDate: order.orderDate,
      orderTotal: order.orderTotal,
      orderStatus: order.orderStatus,
      tagIds: order.tagIds || [],
      shipTo: order.shipTo || {},
      billTo: order.billTo || {},
      items: (order.items || []).map(item => ({
        name: item.name,
        quantity: item.quantity,
        sku: item.sku,
        unitPrice: item.unitPrice,
        customAttributes: item.options || [],
      })),
    }));
    
    return NextResponse.json({
      success: true,
      total: formattedOrders.length,
      page: 1,
      pages: 1,
      orders: formattedOrders,
    });
  } catch (error) {
    console.error('Error fetching ShipStation orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders from ShipStation' }, 
      { status: 500 }
    );
  }
}
