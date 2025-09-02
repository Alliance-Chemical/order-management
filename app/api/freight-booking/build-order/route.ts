import { NextRequest, NextResponse } from 'next/server';
import { MyCarrierOrderInterceptor } from '@/lib/freight-booking/mycarrier/order-interceptor';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { shipstationOrder, carrierSelection, userOverrides } = await request.json();

    if (!shipstationOrder || !carrierSelection) {
      return NextResponse.json({
        success: false,
        error: 'shipstationOrder and carrierSelection are required',
      }, { status: 400 });
    }

    const built = await MyCarrierOrderInterceptor.buildOrderFromFreightSelectionWithSavedClass(
      shipstationOrder,
      carrierSelection,
      userOverrides || {},
    );

    return NextResponse.json({ success: true, order: built });
  } catch (error) {
    console.error('build-order error:', error);
    return NextResponse.json({ success: false, error: 'Failed to build order' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'POST a ShipStation-like order + carrierSelection to get a MyCarrier order with saved classifications applied.'
  });
}

