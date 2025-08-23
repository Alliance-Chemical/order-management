import { NextRequest, NextResponse } from 'next/server';
import { approveOverride } from '@/lib/server/overrides';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const result = await approveOverride(
      body.overrideId,
      body.approvedBy,
      body.workspaceId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error approving override:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve override' },
      { status: 500 }
    );
  }
}