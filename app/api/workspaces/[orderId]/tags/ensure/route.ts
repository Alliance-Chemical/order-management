import { NextRequest, NextResponse } from 'next/server';
import { tagSyncService } from '@/lib/services/shipstation/ensure-phase';
import { normalizeOrderId } from '@/lib/utils/bigint';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const orderIdNum = normalizeOrderId(orderId);
    const body = await request.json();
    const { phase, userId = 'system' } = body;
    
    if (!phase) {
      return NextResponse.json({ error: 'Phase is required' }, { status: 400 });
    }
    
    // Use the tag sync service to ensure correct tags for the phase
    const result = await tagSyncService.ensurePhase(
      orderIdNum,
      phase,
      userId
    );
    
    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Failed to ensure tags',
        details: result
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      orderId: orderId.toString(),
      phase: result.finalPhase,
      tags: result.finalTags,
      changes: result.changes
    });
    
  } catch (error) {
    console.error('Error ensuring tags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}