import { NextResponse } from 'next/server';
import { kvQueue } from '@/lib/queue/kv-queue';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Get stats for all queues
    const [jobs, alerts, webhooks] = await Promise.all([
      kvQueue.stats('jobs'),
      kvQueue.stats('alerts'),
      kvQueue.stats('webhooks'),
    ]);
    
    // Match the expected shape from tests:
    // pending.count, processing.count, deadLetter.count, plus per-queue buckets
    const stats = {
      pending: {
        count: jobs.ready + alerts.ready + webhooks.ready + jobs.scheduled + alerts.scheduled + webhooks.scheduled
      },
      processing: {
        count: 0 // We don't track processing separately in our implementation
      },
      deadLetter: {
        count: jobs.dead + alerts.dead + webhooks.dead
      },
      jobs: {
        ready: jobs.ready,
        scheduled: jobs.scheduled,
        dead: jobs.dead
      },
      alerts: {
        ready: alerts.ready,
        scheduled: alerts.scheduled,
        dead: alerts.dead
      },
      webhooks: {
        ready: webhooks.ready,
        scheduled: webhooks.scheduled,
        dead: webhooks.dead
      },
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(stats);
    
  } catch (error) {
    console.error('Failed to get queue stats:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve queue statistics' },
      { status: 500 }
    );
  }
}
