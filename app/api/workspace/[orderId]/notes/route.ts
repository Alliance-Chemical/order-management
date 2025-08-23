import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const body = await request.json();
    
    // For now, just return success
    // In a real implementation, this would update the workspace notes
    return NextResponse.json({ 
      success: true, 
      orderId,
      note: body.note 
    });
  } catch (error) {
    console.error('Error updating notes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}