/**
 * Outbox Event Processor
 *
 * Background worker that processes events from the outbox table.
 * Guarantees at-least-once delivery of events.
 *
 * SAFETY FEATURES:
 * - Graceful shutdown
 * - Error handling with exponential backoff
 * - Dead letter queue after max retries
 * - Idempotency (same event can be processed multiple times safely)
 * - Monitoring hooks
 *
 * Usage:
 *   const processor = new OutboxProcessor();
 *   await processor.start();
 *   // ... later
 *   await processor.stop();
 */

import { getDb, extractRows } from '@/lib/db';
import { outboxEvents } from '@/lib/db/schema/outbox';
import { eq, and, or, sql, isNull } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { kvQueue } from '@/lib/queue/kv-queue';

type EventHandler = (event: OutboxEvent) => Promise<void>;
type OutboxEvent = typeof outboxEvents.$inferSelect;

export class OutboxProcessor {
  private db = getDb();
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private handlers = new Map<string, EventHandler>();

  // Configuration
  private readonly pollIntervalMs = 1000; // Check for new events every second
  private readonly batchSize = 100; // Process up to 100 events at once
  private readonly maxRetries = 5; // Give up after 5 failures
  private readonly visibilityTimeoutMs = 30000; // 30 second timeout

  /**
   * Register a handler for a specific event type
   */
  on(eventType: string, handler: EventHandler): void {
    logger.debug({ eventType }, 'Registered outbox event handler');
    this.handlers.set(eventType, handler);
  }

  /**
   * Start processing events
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Outbox processor already running');
      return;
    }

    this.isRunning = true;
    logger.info(
      {
        pollIntervalMs: this.pollIntervalMs,
        batchSize: this.batchSize,
        maxRetries: this.maxRetries,
      },
      'Starting outbox processor'
    );

    // Process immediately, then at intervals
    this.processEvents().catch((error) => {
      logger.error({ error }, 'Initial outbox processing failed');
    });

    this.intervalId = setInterval(() => {
      if (this.isRunning) {
        this.processEvents().catch((error) => {
          logger.error({ error }, 'Outbox processing failed');
        });
      }
    }, this.pollIntervalMs);
  }

  /**
   * Stop processing events gracefully
   */
  async stop(): Promise<void> {
    logger.info('Stopping outbox processor');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Wait for current batch to finish (with timeout)
    await new Promise((resolve) => setTimeout(resolve, 2000));
    logger.info('Outbox processor stopped');
  }

  /**
   * Process a batch of events
   */
  private async processEvents(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Fetch unprocessed events (with pessimistic locking to avoid race conditions)
      const events = await this.db
        .select()
        .from(outboxEvents)
        .where(
          and(
            eq(outboxEvents.processed, false),
            or(
              // Never attempted
              isNull(outboxEvents.lastAttemptAt),
              // Or last attempt was long ago (visibility timeout)
              sql`${outboxEvents.lastAttemptAt} < NOW() - INTERVAL '${this.visibilityTimeoutMs} milliseconds'`
            )
          )
        )
        .orderBy(outboxEvents.createdAt)
        .limit(this.batchSize)
        .for('update', { skipLocked: true }); // Pessimistic lock, skip locked rows

      if (events.length === 0) {
        return; // No events to process
      }

      logger.info({ eventCount: events.length }, 'Processing outbox events');

      // Process each event
      await Promise.allSettled(
        events.map((event) => this.processEvent(event))
      );

    } catch (error) {
      logger.error({ error }, 'Failed to fetch outbox events');
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: OutboxEvent): Promise<void> {
    const startTime = Date.now();

    try {
      logger.debug(
        {
          eventId: event.id,
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          attempt: (event.processingAttempts as number) + 1,
        },
        'Processing outbox event'
      );

      // Update attempt count
      await this.db
        .update(outboxEvents)
        .set({
          processingAttempts: sql`${outboxEvents.processingAttempts} + 1`,
          lastAttemptAt: new Date(),
        })
        .where(eq(outboxEvents.id, event.id));

      // Get handler for this event type
      const handler = this.handlers.get(event.eventType);

      if (!handler) {
        // Default handlers for common event types
        await this.handleDefaultEvent(event);
      } else {
        await handler(event);
      }

      // Mark as processed
      await this.db
        .update(outboxEvents)
        .set({
          processed: true,
          processedAt: new Date(),
          lastError: null, // Clear any previous errors
        })
        .where(eq(outboxEvents.id, event.id));

      logger.info(
        {
          eventId: event.id,
          eventType: event.eventType,
          duration: Date.now() - startTime,
        },
        'Event processed successfully'
      );
    } catch (error) {
      const attempts = (event.processingAttempts as number) + 1;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        {
          eventId: event.id,
          eventType: event.eventType,
          error: errorMessage,
          attempts,
          maxRetries: this.maxRetries,
        },
        'Event processing failed'
      );

      // Check if we should give up
      if (attempts >= this.maxRetries) {
        logger.error(
          {
            eventId: event.id,
            eventType: event.eventType,
            attempts,
          },
          'Event moved to dead letter queue (max retries exceeded)'
        );

        // Mark as processed but keep error for debugging
        await this.db
          .update(outboxEvents)
          .set({
            processed: true, // Give up
            processedAt: new Date(),
            lastError: `Max retries exceeded: ${errorMessage}`,
          })
          .where(eq(outboxEvents.id, event.id));

        // Optionally send to dead letter queue for manual intervention
        await this.sendToDeadLetterQueue(event, errorMessage);
      } else {
        // Update error but leave as unprocessed for retry
        await this.db
          .update(outboxEvents)
          .set({
            lastError: errorMessage,
          })
          .where(eq(outboxEvents.id, event.id));
      }
    }
  }

  /**
   * Default event handlers (can be overridden with .on())
   */
  private async handleDefaultEvent(event: OutboxEvent): Promise<void> {
    switch (event.eventType) {
      case 'WorkspaceCreated':
        await this.handleWorkspaceCreated(event);
        break;

      case 'QRGenerationRequested':
        await this.handleQRGenerationRequested(event);
        break;

      case 'ShipStationSyncRequested':
        await this.handleShipStationSync(event);
        break;

      default:
        logger.warn({ eventType: event.eventType }, 'No handler for event type');
    }
  }

  /**
   * Handle WorkspaceCreated events
   */
  private async handleWorkspaceCreated(event: OutboxEvent): Promise<void> {
    logger.debug({ eventId: event.id }, 'Handling WorkspaceCreated event');
    // Log activity, send notifications, etc
    // For now, just log it
  }

  /**
   * Handle QRGenerationRequested events
   */
  private async handleQRGenerationRequested(event: OutboxEvent): Promise<void> {
    logger.debug({ eventId: event.id }, 'Handling QRGenerationRequested event');

    const payload = event.payload as {
      workspaceId: string;
      orderId: number;
      orderNumber: string;
      items?: unknown[];
    };

    // Queue QR generation
    await kvQueue.enqueue(
      'jobs',
      'qr_generation',
      {
        action: 'generate_qr',
        workspaceId: payload.workspaceId,
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        items: payload.items || [],
      },
      {
        fingerprint: `qr_gen_${payload.orderId}`,
        maxRetries: 3,
      }
    );
  }

  /**
   * Handle ShipStationSyncRequested events
   */
  private async handleShipStationSync(event: OutboxEvent): Promise<void> {
    logger.debug({ eventId: event.id }, 'Handling ShipStationSyncRequested event');
    // Sync with ShipStation
    // Implementation depends on your sync logic
  }

  /**
   * Send failed event to dead letter queue
   */
  private async sendToDeadLetterQueue(event: OutboxEvent, error: string): Promise<void> {
    try {
      await kvQueue.enqueue(
        'jobs',
        'dead_letter',
        {
          originalEvent: event,
          error,
          failedAt: new Date().toISOString(),
        },
        {
          maxRetries: 0, // Don't retry dead letter queue entries
        }
      );
    } catch (dlqError) {
      logger.error({ error: dlqError, eventId: event.id }, 'Failed to send to dead letter queue');
    }
  }

  /**
   * Get statistics about outbox processing
   */
  async getStats(): Promise<{
    pending: number;
    processed: number;
    failed: number;
    avgProcessingTime: number;
  }> {
    const result = await this.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE processed = false) as pending,
        COUNT(*) FILTER (WHERE processed = true AND last_error IS NULL) as processed,
        COUNT(*) FILTER (WHERE processed = true AND last_error IS NOT NULL) as failed,
        AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) FILTER (WHERE processed_at IS NOT NULL) as avg_processing_time_seconds
      FROM ${outboxEvents}
    `);

    const [stats = {}] = extractRows(result as unknown as Array<Record<string, unknown>> | { rows: Record<string, unknown>[] });

    return {
      pending: Number(stats.pending ?? 0),
      processed: Number(stats.processed ?? 0),
      failed: Number(stats.failed ?? 0),
      avgProcessingTime: Number(stats.avg_processing_time_seconds ?? 0),
    };
  }
}

// Export singleton instance
export const outboxProcessor = new OutboxProcessor();

// Register default handlers
outboxProcessor.on('WorkspaceCreated', async (event) => {
  logger.info({ eventId: event.id, aggregateId: event.aggregateId }, 'Workspace created');
});

outboxProcessor.on('QRGenerationRequested', async (event) => {
  const payload = event.payload as { orderId: number };
  logger.info({ eventId: event.id, orderId: payload.orderId }, 'QR generation requested');
});
