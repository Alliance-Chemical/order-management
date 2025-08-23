import { NextRequest, NextResponse } from 'next/server';
import { useOverride } from '@/lib/server/overrides';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const result = await useOverride(
      body.overrideId,
      body.usedBy,
      body.workspaceId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error using override:', error);
    return NextResponse.json(
      { error: 'Failed to use override' },
      { status: 500 }
    );
  }
}