/**
 * Outbox Event Writer
 *
 * Helper utilities for writing events to the outbox table within transactions.
 * This ensures that business events are never lost, even if external systems fail.
 */

import { getOptimizedDb } from '@/lib/db/neon';
import { outboxEvents, type OutboxEventInsert } from '@/lib/db/schema/outbox';

export interface CreateOutboxEventParams {
  aggregateId: string;
  aggregateType: 'workspace' | 'freight_order' | 'inspection' | 'container';
  eventType: string;
  eventVersion?: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  createdBy?: string;
}

/**
 * Write an event to the outbox table
 *
 * This should be called within the same database transaction as your business logic.
 * The event will be processed asynchronously by the outbox processor.
 *
 * @example
 * ```typescript
 * await db.transaction(async (tx) => {
 *   // Update business data
 *   await tx.update(workspaces)
 *     .set({ status: 'ready_to_ship' })
 *     .where(eq(workspaces.orderId, orderId));
 *
 *   // Write outbox event
 *   await writeOutboxEvent({
 *     aggregateId: orderId.toString(),
 *     aggregateType: 'workspace',
 *     eventType: 'PreShipCompleted',
 *     payload: { orderId, bolNumber, carrier },
 *   });
 * });
 * ```
 */
export async function writeOutboxEvent(params: CreateOutboxEventParams): Promise<void> {
  const db = getOptimizedDb();

  const event: OutboxEventInsert = {
    aggregateId: params.aggregateId,
    aggregateType: params.aggregateType,
    eventType: params.eventType,
    eventVersion: params.eventVersion || '1.0',
    payload: params.payload,
    processed: false,
    processingAttempts: 0,
    idempotencyKey: params.idempotencyKey,
    createdBy: params.createdBy,
  };

  await db.insert(outboxEvents).values(event);
}

/**
 * Write multiple events to the outbox in a batch
 *
 * Useful when you need to emit multiple events from a single business operation.
 */
export async function writeOutboxEvents(events: CreateOutboxEventParams[]): Promise<void> {
  const db = getOptimizedDb();

  const outboxInserts: OutboxEventInsert[] = events.map(params => ({
    aggregateId: params.aggregateId,
    aggregateType: params.aggregateType,
    eventType: params.eventType,
    eventVersion: params.eventVersion || '1.0',
    payload: params.payload,
    processed: false,
    processingAttempts: 0,
    idempotencyKey: params.idempotencyKey,
    createdBy: params.createdBy,
  }));

  await db.insert(outboxEvents).values(outboxInserts);
}
