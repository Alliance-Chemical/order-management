import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { listPresence } from '@/lib/services/presence';

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) => {
  const { workspaceId } = await params;
  const users = await listPresence(workspaceId);
  return NextResponse.json({ users });
});