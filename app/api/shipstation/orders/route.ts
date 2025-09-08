import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get filter from query params
    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get('filter');
    
    // Get freight order tag ID from environment - show all freight orders
    const freightTagId = parseInt(process.env.FREIGHT_ORDER_TAG || '19844');
    
    // Trim any whitespace from environment variables
    const apiKey = process.env.SHIPSTATION_API_KEY?.trim() || '';
    const apiSecret = process.env.SHIPSTATION_API_SECRET?.trim() || '';
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    
    // Fetch ALL freight-tagged orders using listbytag endpoint
    let allFreightOrders = [];
    let page = 1;
    let hasMorePages = true;
    
    while (hasMorePages) {
      // Retry logic for network issues
      let response;
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
        } catch (error: any) {
          retries--;
          if (retries === 0) throw error;
          console.log(`ShipStation request failed, retrying... (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
        }
      }
      
      if (!response || !response.ok) {
        throw new Error(`ShipStation API error: ${response?.statusText || 'Unknown error'}`);
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
    
    // Format orders for display - filter out discount items
    const formattedOrders = allFreightOrders.map((order: any) => ({
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      customerName: order.shipTo?.name || 'Unknown Customer',
      orderDate: order.orderDate,
      orderTotal: order.orderTotal,
      orderStatus: order.orderStatus,
      tagIds: order.tagIds || [],
      shipTo: order.shipTo || {},
      billTo: order.billTo || {},
      items: order.items?.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        sku: item.sku,
        unitPrice: item.unitPrice,
        customAttributes: item.options || [],
      })) || [],
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