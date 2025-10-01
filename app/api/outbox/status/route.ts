/**
 * Outbox Processor Status & Control Endpoint
 *
 * GET /api/outbox/status - Get processor stats
 * POST /api/outbox/status - Start/stop processor
 *
 * SAFE: Read-only by default, requires admin token for control
 */

import { NextRequest, NextResponse } from 'next/server';
import { outboxProcessor } from '@/lib/services/outbox/processor';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET - Get outbox processor status
 */
export async function GET(_request: NextRequest) {
  try {
    const stats = await outboxProcessor.getStats();

    return NextResponse.json({
      success: true,
      stats: {
        pending: stats.pending,
        processed: stats.processed,
        failed: stats.failed,
        avgProcessingTimeSeconds: stats.avgProcessingTime.toFixed(2),
      },
      health: {
        healthy: stats.pending < 1000 && stats.failed < 100,
        alerts: [
          stats.pending > 1000 ? 'High backlog of pending events' : null,
          stats.failed > 100 ? 'High failure rate' : null,
        ].filter(Boolean),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get outbox stats');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Start or stop processor (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Simple auth check (in production, use proper auth)
    const authHeader = request.headers.get('authorization');
    const adminToken = process.env.ADMIN_TOKEN;

    if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - admin token required',
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as { action: 'start' | 'stop' };

    if (body.action === 'start') {
      await outboxProcessor.start();
      logger.info('Outbox processor started via API');

      return NextResponse.json({
        success: true,
        message: 'Outbox processor started',
      });
    } else if (body.action === 'stop') {
      await outboxProcessor.stop();
      logger.info('Outbox processor stopped via API');

      return NextResponse.json({
        success: true,
        message: 'Outbox processor stopped',
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action - must be "start" or "stop"',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error({ error }, 'Failed to control outbox processor');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}