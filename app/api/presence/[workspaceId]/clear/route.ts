import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { clearPresence } from '@/lib/services/presence';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';

const repository = new WorkspaceRepository();

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) => {
  const { workspaceId } = await params;
  const body = await request.json();
  const { userId } = body;
  
  if (!userId) {
    return NextResponse.json(
      { error: 'userId required' },
      { status: 400 }
    );
  }
  
  await clearPresence(workspaceId, userId);
  
  // Log activity
  await repository.logActivity({
    workspaceId,
    activityType: 'presence_cleared',
    performedBy: userId,
    metadata: {}
  });
  
  return NextResponse.json({ success: true });
});