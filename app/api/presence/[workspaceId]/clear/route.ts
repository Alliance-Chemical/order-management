import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { clearPresence } from '@/lib/services/presence';
import { getEdgeDb, withEdgeRetry } from '@/lib/db/neon-edge';
import { activityLog } from '@/lib/db/schema/qr-workspace';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type ClearPresenceParams = { workspaceId: string };
type ClearPresencePayload = { userId?: string };

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<ClearPresenceParams> }
) => {
  const { workspaceId } = await params;
  const body = (await request.json()) as ClearPresencePayload;
  const { userId } = body;
  
  if (!userId) {
    return NextResponse.json(
      { error: 'userId required' },
      { status: 400 }
    );
  }
  
  await clearPresence(workspaceId, userId);
  
  // Log activity (Edge DB)
  const db = getEdgeDb();
  await withEdgeRetry(() => db.insert(activityLog).values({
    workspaceId,
    activityType: 'presence_cleared',
    performedBy: userId,
    performedAt: new Date(),
    metadata: {},
  }));
  
  return NextResponse.json({ success: true });
});
