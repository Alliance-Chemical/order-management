import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { touchPresence } from '@/lib/services/presence';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';

const repository = new WorkspaceRepository();

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) => {
  const { workspaceId } = await params;
  const body = await request.json();
  const { userId, userName, role, activity } = body;
  
  if (!userId || !userName || !role || !activity) {
    return NextResponse.json(
      { error: 'userId, userName, role, and activity required' },
      { status: 400 }
    );
  }
  
  await touchPresence(workspaceId, {
    id: userId,
    name: userName,
    role,
    activity
  });
  
  // Log activity
  await repository.logActivity({
    workspaceId,
    activityType: 'presence_updated',
    performedBy: userId,
    metadata: { activity }
  });
  
  return NextResponse.json({ success: true });
});