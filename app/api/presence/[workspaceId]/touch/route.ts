import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { touchPresence } from '@/lib/services/presence';
import { getEdgeDb, withEdgeRetry } from '@/lib/db/neon-edge';
import { activityLog } from '@/lib/db/schema/qr-workspace';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

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
  
  // Log activity (Edge DB)
  const db = getEdgeDb();
  await withEdgeRetry(() => db.insert(activityLog).values({
    workspaceId,
    activityType: 'presence_updated',
    performedBy: userId,
    performedAt: new Date(),
    metadata: { activity } as any,
  }));
  
  return NextResponse.json({ success: true });
});
