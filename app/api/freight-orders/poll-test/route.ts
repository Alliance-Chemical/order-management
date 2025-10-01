/**
 * Shadow Mode Test Endpoint
 *
 * SAFE: Runs new batch polling in parallel with old sequential polling
 * Compares results without affecting production behavior
 *
 * Usage: GET /api/freight-orders/poll-test
 *
 * Returns:
 * {
 *   "old": { "duration": 5234, "created": 10, "existing": 115 },
 *   "new": { "duration": 342, "created": 10, "existing": 115, "queries": 4 },
 *   "speedup": "93.5%",
 *   "resultMatch": true,
 *   "recommendation": "Safe to enable batch_polling flag"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { batchFreightPollingService } from '@/lib/services/freight/batch-polling';
import { logger, withRequestContext } from '@/lib/logger';
import { ShipStationOrder } from '@/lib/services/shipstation/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for comparison

export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

  return withRequestContext({ requestId, userId: 'test-user', route: '/api/freight-orders/poll-test' }, async () => {
    try {
      logger.info('Starting shadow mode performance test');

      // Fetch freight orders from ShipStation (same as production)
      const freightOrders = await fetchFreightOrders();

      if (freightOrders.length === 0) {
        return NextResponse.json({
          message: 'No freight orders to test',
          suggestion: 'Add some orders with freight tag in ShipStation',
        });
      }

      logger.info({ orderCount: freightOrders.length }, 'Fetched freight orders for testing');

      // Run comparison (old vs new)
      const comparison = await batchFreightPollingService.comparePerformance(
        freightOrders,
        async () => {
          // OLD WAY: Sequential processing (what you have now)
          return await oldSequentialPolling(freightOrders);
        }
      );

      // Calculate savings
      const timeSaved = comparison.sequential.duration - comparison.batch.duration;
      const queriesSaved = freightOrders.length * 3 - comparison.batch.queriesExecuted; // Estimate

      // Make recommendation
      let recommendation = '';
      if (comparison.resultMatch && parseFloat(comparison.speedup) > 50) {
        recommendation = '✅ Safe to enable batch_polling flag - massive speedup with identical results';
      } else if (comparison.resultMatch) {
        recommendation = '⚠️ Results match but speedup is modest - consider enabling if load is high';
      } else {
        recommendation = '❌ Results DO NOT match - do not enable batch_polling yet, investigate differences';
      }

      return NextResponse.json({
        success: true,
        ordersTested: freightOrders.length,
        old: {
          duration: comparison.sequential.duration,
          created: comparison.sequential.created,
          existing: comparison.sequential.existing,
          estimatedQueries: freightOrders.length * 3, // Rough estimate
        },
        new: {
          duration: comparison.batch.duration,
          created: comparison.batch.created,
          existing: comparison.batch.existing,
          queriesExecuted: comparison.batch.queriesExecuted,
        },
        improvement: {
          speedup: comparison.speedup,
          timeSavedMs: timeSaved,
          queriesSaved,
          efficiency: `${((1 - comparison.batch.duration / comparison.sequential.duration) * 100).toFixed(1)}% faster`,
        },
        validation: {
          resultMatch: comparison.resultMatch,
          createdMatch: comparison.sequential.created === comparison.batch.created,
          existingMatch: comparison.sequential.existing === comparison.batch.existing,
        },
        recommendation,
      });
    } catch (error) {
      logger.error({ error }, 'Shadow mode test failed');

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: 'Shadow mode test failed - old code would still work',
        },
        { status: 500 }
      );
    }
  });
}

/**
 * Fetch freight orders from ShipStation (same as production)
 */
async function fetchFreightOrders(): Promise<ShipStationOrder[]> {
  const freightTagId = parseInt(process.env.FREIGHT_ORDER_TAG || '19844', 10);
  const apiKey = process.env.SHIPSTATION_API_KEY?.trim() || '';
  const apiSecret = process.env.SHIPSTATION_API_SECRET?.trim() || '';
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

  let allOrders: ShipStationOrder[] = [];
  let page = 1;
  let hasMorePages = true;

  while (hasMorePages && page <= 3) {
    // Limit to 3 pages for testing
    const response = await fetch(
      `https://ssapi.shipstation.com/orders/listbytag?` +
        `orderStatus=awaiting_shipment&` +
        `tagId=${freightTagId}&` +
        `page=${page}&` +
        `pageSize=100`, // Smaller page size for testing
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`ShipStation API error: ${response.statusText}`);
    }

    const data = (await response.json()) as { orders?: ShipStationOrder[]; pages?: number };
    const orders = data.orders ?? [];

    allOrders = [...allOrders, ...orders];
    hasMorePages = data.pages ? page < data.pages : false;
    page++;

    if (hasMorePages) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return allOrders;
}

/**
 * OLD WAY: Sequential polling (simulate current behavior)
 */
async function oldSequentialPolling(orders: ShipStationOrder[]): Promise<{
  created: unknown[];
  existing: unknown[];
}> {
  logger.info({ orderCount: orders.length }, 'Running old sequential polling');

  const created: unknown[] = [];
  const existing: unknown[] = [];

  // Simulate old behavior: query DB for each order individually
  const db = (await import('@/src/data/db/client')).getDb();
  const { workspaces } = await import('@/lib/db/schema/qr-workspace');
  const { eq } = await import('drizzle-orm');

  for (const order of orders) {
    // Query DB for EACH order (N queries)
    const [existingWorkspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, order.orderId))
      .limit(1);

    if (existingWorkspace) {
      existing.push({
        orderId: order.orderId,
        workspaceId: existingWorkspace.id,
      });
    } else {
      // Would create workspace here (but we skip to avoid duplicate data in test)
      created.push({
        orderId: order.orderId,
        orderNumber: order.orderNumber,
      });
    }
  }

  logger.info({ created: created.length, existing: existing.length }, 'Old sequential polling complete');

  return { created, existing };
}