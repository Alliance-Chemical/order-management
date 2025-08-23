import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { approveOverride } from '@/lib/server/overrides';

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();
  const { approvedBy, workspaceId } = body;
  
  if (!approvedBy || !workspaceId) {
    return NextResponse.json(
      { error: 'approvedBy and workspaceId required' },
      { status: 400 }
    );
  }
  
  const result = await approveOverride(id, approvedBy, workspaceId);
  return NextResponse.json(result);
});