import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { useOverride } from '@/lib/server/overrides';

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();
  const { usedBy, workspaceId } = body;
  
  if (!usedBy || !workspaceId) {
    return NextResponse.json(
      { error: 'usedBy and workspaceId required' },
      { status: 400 }
    );
  }
  
  const result = await useOverride(id, usedBy, workspaceId);
  return NextResponse.json(result);
});