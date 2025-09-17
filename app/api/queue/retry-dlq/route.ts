import { NextRequest, NextResponse } from 'next/server';
import { kvQueue, type QueueName } from '@/lib/queue/kv-queue';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = (await request.json().catch(() => ({}))) as Partial<{ queue: QueueName; count: number }>;
    const { queue = 'jobs', count = 10 } = body;
    
    // Validate queue name
    const validQueues: QueueName[] = ['jobs', 'alerts', 'webhooks'];
    if (!validQueues.includes(queue)) {
      return NextResponse.json(
        { error: 'Invalid queue name' },
        { status: 400 }
      );
    }
    
    // Retry deadletter messages
    const retried = await kvQueue.retryDeadletter(queue, count);
    
    console.log(`Retried ${retried} deadletter messages from ${queue} queue`);
    
    return NextResponse.json({
      success: true,
      queue,
      requested: count,
      retried,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Failed to retry deadletter messages:', error);
    return NextResponse.json(
      { error: 'Failed to retry deadletter messages' },
      { status: 500 }
    );
  }
}
