import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { tagId, orderNumber, startDate, endDate } = await request.json();
    
    // Trim any whitespace from environment variables
    const apiKey = process.env.SHIPSTATION_API_KEY?.trim() || '';
    const apiSecret = process.env.SHIPSTATION_API_SECRET?.trim() || '';
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    
    // Build query parameters
    const params = new URLSearchParams();
    
    if (tagId) {
      params.append('tagId', tagId.toString());
    }
    
    if (orderNumber) {
      params.append('orderNumber', orderNumber);
    }
    
    // Default to last 7 days if no date range specified
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate || new Date().toISOString();
    
    params.append('modifyDateStart', start);
    params.append('modifyDateEnd', end);
    params.append('pageSize', '100');
    params.append('orderStatus', 'awaiting_shipment');
    
    const response = await fetch(
      `https://ssapi.shipstation.com/orders?${params.toString()}`,
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
    
    // Format orders for display
    const orders = (data.orders || []).map((order: any) => ({
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      customerName: order.shipTo?.name || 'N/A',
      orderDate: order.orderDate,
      orderTotal: order.orderTotal,
      orderStatus: order.orderStatus,
      tagIds: order.tagIds || [],
      items: order.items?.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        sku: item.sku,
      })),
    }));
    
    return NextResponse.json({
      success: true,
      total: data.total,
      page: data.page,
      pages: data.pages,
      orders,
    });
  } catch (error) {
    console.error('Error searching ShipStation orders:', error);
    return NextResponse.json({ error: 'Failed to search orders' }, { status: 500 });
  }
}